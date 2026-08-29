#!/usr/bin/env python3
"""
Build split registry files from corpora cards.

Reads all corpora cards from cli/shared/corpora-cards/ and generates
per-source registry files in arena/datasets/:

    registry-prize.json     — EdTeKLA + community-curated prize corpora
    registry-tatoeba.json   — Tatoeba Challenge pairs (eval cards)
    registry-flores.json    — FLORES+ multiway expansion (multiway card)
    registry-ntrex.json     — NTREX-128 multiway expansion (multiway card)

Each registry file has the same shape:
    { "registry_version": "3.0.0", "datasets": [...] }

The harness's load_registry() merges them at runtime.

Why split?
    1. Contaminated sources (FLORES, NTREX) are easily excludable from
       mesh efficiency calculations — just don't load those files
    2. Prize corpora (EdTeKLA) are separate from dev-baseline corpora
    3. Each file is independently diffable and auditable

SSOT: one truth, one place — edit the card, rebuild the registries.

Usage:
    python arena/scripts/build_registry.py           # build all
    python arena/scripts/build_registry.py --dry-run  # preview without writing
    python arena/scripts/build_registry.py --diff     # show diff against current
"""

import json
import sys
from pathlib import Path

# --- Paths ---
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent

# ISO code-scope resolution (sibling module; single home for scope logic —
# reads the pinned official ISO 639-3/-5 tables under cli/data/).
sys.path.insert(0, str(SCRIPT_DIR))
import iso_resolution  # noqa: E402
CARDS_DIR = REPO_ROOT / "cli" / "shared" / "corpora-cards"
REGISTRY_DIR = REPO_ROOT / "arena" / "datasets"
CODE_BRIDGE_PATH = REPO_ROOT / "cli" / "shared" / "code-bridge.json"
# Closed domain taxonomy SSOT — the ONLY domains a card may declare (17 content
# codes + the composite marker 'mixed'). build_registry hard-fails any card
# whose domain is outside this set, and refuses bare 'mixed' (no distribution).
DOMAIN_TAXONOMY_PATH = REPO_ROOT / "shared" / "domain-taxonomy.json"

# Legacy single-file path (for --diff comparison)
LEGACY_REGISTRY_PATH = REGISTRY_DIR / "registry.json"

# Bundled copy shipped INSIDE the package, so `pip install mt-eval-harness`
# carries a registry with no monorepo present (config.load_registry resolution
# step 3 — the offline fallback under the remote fetch). Gitignored; generated.
BUNDLED_REGISTRY_PATH = REPO_ROOT / "arena" / "mt_eval_harness" / "data" / "registry.json"

# --- Flags ---
DRY_RUN = "--dry-run" in sys.argv
SHOW_DIFF = "--diff" in sys.argv


# ---------------------------------------------------------------------------
# Code bridge — maps external source codes to project ISO 639-3
# ---------------------------------------------------------------------------

def load_code_bridge() -> dict:
    """Load the SSOT code mapping from cli/shared/code-bridge.json.

    Returns a dict keyed by source namespace ("flores", "ntrex", "tatoeba"),
    each mapping external codes to ISO 639-3 project codes.
    Falls back to empty mappings if the file doesn't exist yet.
    """
    if not CODE_BRIDGE_PATH.exists():
        return {}
    return json.loads(CODE_BRIDGE_PATH.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Domain taxonomy — the closed SSOT of valid domain codes
# ---------------------------------------------------------------------------

def load_domain_taxonomy() -> tuple[frozenset, frozenset]:
    """Load the closed domain taxonomy from shared/domain-taxonomy.json.

    Returns ``(content_codes, composite_codes)``:
        content_codes   — the 17 content domains valid as a sole/primary label.
        composite_codes — non-content markers ({'mixed'}); valid as a domain
                          ONLY when accompanied by a domainDistribution.

    A missing/broken SSOT is fatal: the registry's whole job here is to enforce
    the taxonomy, so we refuse to build without it rather than silently fall back
    to a free-text domain.
    """
    if not DOMAIN_TAXONOMY_PATH.exists():
        raise SystemExit(
            f"FATAL: domain taxonomy SSOT not found at {DOMAIN_TAXONOMY_PATH}. "
            f"build_registry validates every card's domain against it and refuses "
            f"to run without it."
        )
    data = json.loads(DOMAIN_TAXONOMY_PATH.read_text(encoding="utf-8"))
    content = frozenset(data.get("domains", {}).keys())
    composite = frozenset(data.get("composite", {}).keys())
    if not content:
        raise SystemExit(
            f"FATAL: domain taxonomy SSOT {DOMAIN_TAXONOMY_PATH} has no 'domains'."
        )
    return content, composite


CONTENT_DOMAINS, COMPOSITE_DOMAINS = load_domain_taxonomy()
VALID_DOMAINS = CONTENT_DOMAINS | COMPOSITE_DOMAINS


def validate_domain(domain, distribution, entry_id: str) -> None:
    """Hard-fail the build if ``domain`` is outside the closed taxonomy.

    Mirrors the sovereignty gate's strictness: a bad domain stops the build (the
    registry must never advertise a corpus on an invented domain code). Two rules:
      1. ``domain`` must be one of the 17 content codes or the composite 'mixed'.
         A missing/None domain (the old silent ``"mixed"`` default) fails here.
      2. The composite 'mixed' MUST carry a domainDistribution — 'mixed' as a
         bare label is exactly the unclassified junk this taxonomy replaces.
    """
    if domain not in VALID_DOMAINS:
        raise SystemExit(
            f"DOMAIN VALIDATION ERROR [{entry_id}]: domain {domain!r} is not in the "
            f"closed taxonomy (shared/domain-taxonomy.json). Valid content codes: "
            f"{sorted(CONTENT_DOMAINS)}; composite: {sorted(COMPOSITE_DOMAINS)}. "
            f"Fix the card's domain before rebuilding."
        )
    if domain in COMPOSITE_DOMAINS and not distribution:
        raise SystemExit(
            f"DOMAIN VALIDATION ERROR [{entry_id}]: domain {domain!r} is a composite "
            f"marker and MUST be accompanied by a domainDistribution. "
            f"'{domain}' as a bare label is not allowed — give it a domainDistribution "
            f"or pick a single content code."
        )


def proportions_to_counts(distribution, size):
    """Convert a proportional domainDistribution to the registry's count form.

    Cards store domain proportions (0.0-1.0); the registry historically stores
    per-domain entry counts. Returns None when there is nothing to convert, so a
    card without a distribution yields ``domain_distribution: null`` unchanged.
    """
    if not distribution or not size:
        return None
    return {domain: round(proportion * size)
            for domain, proportion in distribution.items()}


# ---------------------------------------------------------------------------
# Registry source classification
# ---------------------------------------------------------------------------

# Determines which split registry file a card's entries go into.
# The classification is based on the card id and type.
_SOURCE_CLASSIFIERS = {
    # EdTeKLA and community prize corpora → prize
    "edtekla": "prize",
    "prize": "prize",
    # GlobalVoices citizen journalism (CC-BY-4.0, news domain)
    "globalvoices": "globalvoices",
    # Gamayun / CLEAR Global humanitarian kits (CC-BY-4.0)
    "gamayun": "gamayun",
}


def classify_registry_source(card: dict) -> str:
    """Determine which split registry file a card belongs to.

    Returns one of: 'prize', 'tatoeba', 'flores', 'ntrex', or 'tatoeba'
    (default for unclassified eval cards).
    """
    card_id = card.get("id", "")
    card_type = card.get("type", "")

    # Multiway cards are named by their source
    if card_type == "multiway":
        if "flores" in card_id:
            return "flores"
        if "ntrex" in card_id:
            return "ntrex"
        # Generic multiway — use card id prefix
        return card_id.split("-")[1] if "-" in card_id else "other"

    # Eval cards — classify by known prefixes
    for prefix, source in _SOURCE_CLASSIFIERS.items():
        if prefix in card_id:
            return source

    # Default: Tatoeba-derived dev corpora
    return "tatoeba"


# ---------------------------------------------------------------------------
# Language-code resolution stamps (Position 4 v2 — docs/LANGUAGE_TAXONOMY.md)
# ---------------------------------------------------------------------------
# Upstream corpora label pairs with a mix of individual, macrolanguage,
# collective, retired, and script-suffixed codes. Those labels are metadata to
# RESOLVE, never truths to obey or discard: ``language_pair`` stays
# upstream-faithful (and entry ids/paths stay stable), while every entry
# carries a derived ``language_resolution`` block naming the ACTIVE INDIVIDUAL
# ISO 639-3 code each side benchmark-resolves to — or the machine-readable
# reason it does not. Mechanical resolution (script strip, clean retirements)
# comes from iso_resolution.py over the pinned official tables; VARIETY
# judgments come only from an authored ``varietyResolution`` pin on the
# corpora card (the transmissionPolicy pattern: agents record pins only with
# an upstream-documented basis; everything else goes to
# docs/PROPOSED_VARIETY_PINS.md for founder ratification).


def validate_variety_resolution(card: dict) -> dict:
    """Validate a card's authored ``varietyResolution`` pins — hard-fail on
    any pin that is not a macrolanguage resolving to one of its own ACTIVE
    INDIVIDUAL members with full provenance. Returns {macro_code: pin}.

    Strictness mirrors validate_domain: a bad pin stops the build (the
    registry must never advertise a variety claim the ISO tables refute).
    """
    pins = card.get("varietyResolution") or {}
    card_id = card.get("id", "?")
    for macro, pin in pins.items():
        if iso_resolution.classify(macro) != "macrolanguage":
            raise SystemExit(
                f"VARIETY PIN ERROR [{card_id}]: '{macro}' is not an ISO "
                f"639-3 macrolanguage (classified "
                f"'{iso_resolution.classify(macro)}') — pins resolve macro "
                f"labels only; mechanical cases (script suffixes, retired "
                f"codes) are derived automatically."
            )
        resolved = (pin or {}).get("resolvedCode")
        missing = [k for k in ("resolvedCode", "basis", "recordedBy",
                               "recordedAt") if not (pin or {}).get(k)]
        if missing:
            raise SystemExit(
                f"VARIETY PIN ERROR [{card_id}]: pin '{macro}' is missing "
                f"{missing} — a variety judgment without a citable basis "
                f"and provenance is not recordable."
            )
        if not iso_resolution.is_active_member(macro, resolved):
            raise SystemExit(
                f"VARIETY PIN ERROR [{card_id}]: '{macro}' → '{resolved}' "
                f"is not an ACTIVE INDIVIDUAL member of that macrolanguage "
                f"per the pinned ISO 639-3 M-table."
            )
    return pins


def attach_language_resolution(entry: dict, pins: dict) -> None:
    """Stamp the derived ``language_resolution`` block onto one entry."""
    lp = entry.get("language_pair") or {}
    block = {}
    reasons = []
    for side in ("source", "target"):
        code = lp.get(side) or ""
        base, _script = iso_resolution.parse_code(code)
        pin = pins.get(base)
        stamp = iso_resolution.resolve_side(
            code, (pin or {}).get("resolvedCode"),
        )
        if stamp["via"] == "variety-pin":
            stamp["pin"] = {k: pin[k] for k in ("basis", "recordedBy",
                                                "recordedAt")}
        block[side] = stamp
        if stamp["resolved"] is None:
            reasons.append(f"{side}-{stamp['scope']}:{code}")
    block["benchmark_eligible"] = not reasons
    block["exclusion_reasons"] = reasons
    entry["language_resolution"] = block


# ---------------------------------------------------------------------------
# Card → registry entry conversion (eval cards)
# ---------------------------------------------------------------------------

def card_to_registry_entry(card: dict) -> dict:
    """Convert an eval-type corpora card to a registry entry.

    The registry entry preserves backward compatibility with the
    existing resolve_dataset() function in config.py, while carrying
    through fetch-from-source build metadata, richness metrics, and
    aliases that cards store.
    """
    pair = card.get("pair", {})
    dev = card.get("dev", {})
    source = card.get("source", {})

    # Validate the declared domain against the closed taxonomy (hard-fail on an
    # invalid code or a bare 'mixed'). No silent default to 'mixed': a card that
    # forgets its domain must be fixed, not papered over.
    dev_domain = dev.get("domain")
    dev_dist = dev.get("domainDistribution")
    validate_domain(dev_domain, dev_dist, card.get("id", "?"))

    # Convert the proportional domain distribution to the registry's count form.
    size = dev.get("size", 0)
    domain_dist = proportions_to_counts(dev_dist, size)

    # Extract sovereignty and usage restriction fields
    sovereignty = card.get("sovereignty") or {}
    usage = card.get("usageRestrictions") or {}

    # Determine access mode and sha256 from the card's source block
    has_build_recipe = bool(source.get("repo_url") and source.get("builder"))
    access = "fetch-from-source" if has_build_recipe else "local"
    sha256 = source.get("sha256")

    # Build the source_export block for fetch-from-source corpora
    source_export = None
    if has_build_recipe:
        source_export = {
            "builder": source.get("builder"),
            "url": source.get("repo_url"),
            "sha256": source.get("archive_sha256") or (
                # For Tatoeba Challenge corpora, the archive sha256 is the
                # well-known consolidated test archive pin
                "9eef2fb5fe4551401de3675d8e98ad0e9455d063ab51c77ad85870f4b38a39f2"
                if source.get("builder") == "tatoeba-challenge" else None
            ),
            "member": source.get("member"),
            "license": source.get("license"),
            "license_url": source.get("license_url"),
        }
        recipe = source.get("recipe")
        if recipe:
            source_export["recipe"] = recipe

    # Build the registry entry
    entry = {
        "id": card["id"],
        "name": card["name"],
        "version": card["version"],
        "language_pair": {
            "source": pair.get("source", "unk"),
            "target": pair.get("target", "unk")
        },
        "size": dev.get("size", 0),
        "domain": dev_domain,
        "domain_distribution": domain_dist if domain_dist else None,
        "url": None,
        "sha256": sha256,
        "access": access,
        "do_not_train": card.get("doNotTrain", True),
        "license": card.get("license", {}).get("spdx", ""),
        "source": source.get("publisher", ""),
        "path": dev.get("dataFile", ""),
        "segment": "development",
        "notes": card.get("description", ""),
        "attribution": f"{source.get('publisher', '')} ({card.get('license', {}).get('spdx', '')})",
        # sovereignty-aspirant fields
        "sovereignty_frameworks": sovereignty.get("frameworks", []),
        "usage_training": usage.get("training"),
        "usage_commercial": usage.get("commercialUse"),
        "community_notes": usage.get("communityNotes"),
    }

    # Contamination level — carried through so downstream consumers
    # (queue ranking, leaderboard badges) can reason about it without
    # re-reading cards. Cards use either 'level' or 'risk' for the grade.
    contam = card.get("contamination") or {}
    contam_level = contam.get("level") or contam.get("risk")
    # A published held-out benchmark is forced HIGH so a memorized score can
    # never display as absolute quality — overriding any optimistic card grade.
    # The card declares it; no id is matched. See is_held_out_benchmark.
    if is_held_out_benchmark(
            None, None, card.get("id", ""),
            declared_held_out=bool(card.get(HELD_OUT_BENCHMARK_CARD_FIELD))):
        contam_level = "HIGH"
    if contam_level:
        entry["contamination"] = contam_level

    # Quarantine flag — an explicit, acknowledged "catalogued but not
    # runnable" marker. The queue (queue_corpora) skips quarantined sets;
    # the buildability gate exempts them from the builder-exists check but
    # reports them loudly. Carrying the reason keeps the audit trail.
    if card.get("quarantine"):
        entry["quarantine"] = True
        if card.get("quarantineReason"):
            entry["quarantine_reason"] = card["quarantineReason"]

    # License-review stamp — carried verbatim from the card so every
    # registry consumer (queue, board, docs) can answer "who cleared this,
    # when, on what basis" without reading the intake tracker.
    _stamp_license_review(entry, card)

    # Transmission policy (additive) — the card may pin a data-side
    # transmission mode ("no-train" | "consent-required") and/or record the
    # rights-holder's explicit permission grant. Consumed by
    # mt_eval_harness.transmission_policy; absent fields fall back to the
    # license-string default (LicenseRef/bespoke/unstated → consent-required).
    if card.get("transmissionPolicy"):
        entry["transmission_policy"] = card["transmissionPolicy"]
    if card.get("transmissionConsent"):
        entry["transmission_consent"] = card["transmissionConsent"]

    # Gated-source metadata (additive) — if an eval card declares a gated
    # download (accept-terms + token), carry the exact terms URL + token env
    # var name through so the TUI + fail-honest errors can render per-dataset
    # instructions. Only emitted when actually gated, so non-gated eval entries
    # stay byte-identical to before.
    download = card.get("download") or {}
    if download.get("gated"):
        entry["gated"] = True
        if download.get("termsUrl"):
            entry["terms_url"] = download["termsUrl"]
        if download.get("tokenEnv"):
            entry["token_env"] = download["tokenEnv"]
        if source_export is not None:
            source_export["gated"] = True
            if download.get("termsUrl"):
                source_export["terms_url"] = download["termsUrl"]
            if download.get("tokenEnv"):
                source_export["token_env"] = download["tokenEnv"]

    # Aliases for dataset resolution (e.g., "edtekla-dev" → "eval-eng-crk-edtekla-dev-v1")
    aliases = card.get("aliases")
    if aliases:
        entry["aliases"] = aliases

    # Source export for fetch-from-source corpora
    if source_export:
        entry["source_export"] = source_export

    # Richness metrics for queue prioritization
    richness = card.get("richness")
    if richness:
        entry["richness"] = richness

    # Language-code resolution stamp (Position 4 v2): what each side of the
    # upstream-faithful language_pair benchmark-resolves to, or why it can't.
    attach_language_resolution(entry, validate_variety_resolution(card))

    return entry


# ---------------------------------------------------------------------------
# Multiway card → registry entries expansion
# ---------------------------------------------------------------------------

# Multiway sources promoted into the runnable lane. These are low-contamination
# multi-way *test* sets that we DO run and queue (registered builders, archive
# sha pins). Like the GlobalVoices "test" tail splits, their per-pair entries
# are tagged segment="development" (the runnable-lane label) so they enter
# registry.json / the queue / the mesh, while their source_export.segment keeps
# the real upstream split.
# Keyed by builder namespace (card_id.split('-')[1]). The segment="development"
# tag is the SINGLE promotion mechanism: every downstream consumer
# (queue_corpora, the fallback merge, the buildability gate) already keys off
# it, so no parallel constant is needed elsewhere.
PROMOTED_MULTIWAY_SOURCES = {
    "tico19", "in22",
    # FLORES+ / NTREX admission (founder decision 2026-08-27): NOT via this
    # set. Blanket source-level promotion would label every expanded pair
    # segment="development" — including the tens of thousands of UNBUILT
    # pairs whose per-pair shas don't exist, whose published runs the
    # sha-parity guard (migration 026) would then refuse. The honest
    # carrier is the cards' promotedSubset mechanism (curated slice, exact
    # source codes, pinned revision, per-pair built shas — see the curated
    # promotion block in expand_multiway_card): those pairs are already
    # runnable-lane, and lane-both (2026-08-27) lets them enqueue across
    # the full model lineup. Widening admission = extending promotedSubset
    # with built shas (a batch build job), never flipping this set.
    # Six-corpora buildout (2026-06-19): commercial-safe, fetch-from-source
    # eval sets promoted into the runnable lane. ALT (CC-BY-4.0) and Turkic
    # X-WMT (MIT) are genuinely N-way (all-pairs); WMT24++ (Apache-2.0) and
    # SMOL (CC-BY-4.0) are directed/curated (explicitPairs).
    "alt", "turkicxwmt", "wmt24pp", "smol",
    # WMT General/News blind test sets (2026-06-24): the clean held-out tier,
    # fetched from source via sacreBLEU (-t). EVERY edition is promoted into the
    # runnable lane (research-use license, relative-comparison + absolute lanes).
    # The OLDER editions (wmt14..wmt23) are ALSO in HELD_OUT_BENCHMARK_FAMILIES →
    # forced HIGH → relative-only, exactly like wmt24pp. The FRESHEST (wmt24,
    # wmt25) are NOT held-out: they declare freshBlindTestSet=true + an honest
    # LOW grade, so they stay absolute-rankable (see is_held_out_benchmark and the
    # SAFETY CONTRACT in expand_multiway_card). wmt25 ships quarantined (its
    # sacreBLEU edition isn't bundled yet) — promotion is harmless until then.
    "wmt14", "wmt15", "wmt16", "wmt17", "wmt18", "wmt19",
    "wmt20", "wmt21", "wmt22", "wmt23", "wmt24", "wmt25",
    # AmericasNLP shared task (2026-07-07): Spanish → Indigenous-languages-of-
    # the-Americas held-out test set (2021 edition; test references public).
    # Promoted so flipping its quarantine off is a one-field change; forced HIGH
    # via HELD_OUT_BENCHMARK_FAMILIES → relative-only. The 2026-08-24 license
    # review HELD it (mixed, partly unstated per-language terms — never
    # interpreted on the rights-holders' behalf); the card's quarantine keeps
    # it out of the queue/mesh, and the verdict rides the card's licenseReview.
    "americasnlp2021",
    # Recipe-batch shared tasks (2026-07-07, master-plan A3 batch 1): MAFAND-MT
    # (African news, en/fr↔20 langs, CC-BY-NC) + LoResMT 2020 (hi↔bho/mag/ru,
    # CC-BY-NC-SA) + LoResMT 2021 (en↔ga/mr COVID, CC-BY-NC-SA). All clearly-NC
    # → cleared into the NC research lane by the 2026-08-24 license review
    # (verdict stamps ride the cards' licenseReview); forced HIGH via
    # HELD_OUT_BENCHMARK_FAMILIES → relative-only.
    "mafand", "loresmt2020", "loresmt2021",
    # Recipe batch 2 (2026-07-07, the single-file pairing-mode extension):
    # NusaX (ind↔10 local + eng, 12-way CSV, data CC-BY-SA — the one
    # commercial-compatible license in the batch) + NusaTranslation
    # (ind↔10 local, per-lang CSVs, data license UNSTATED) + MENYO-20k
    # (en↔yor multi-domain TSV, CC-BY-NC; cross-contaminated with the MAFAND
    # yor test set, which derives from it) + BSD (en↔ja doc-level dialogue
    # JSON, CC-BY-NC-SA) + NICT-SAP/SAP software documentation (en↔hi/id/
    # ms/th IT domain, line-zip, CC-BY-NC). Reviewed 2026-08-24: NusaX
    # cleared commercial-compatible; MENYO-20k, BSD and NICT-SAP cleared into
    # the NC research lane; NusaTranslation HELD (data license unstated —
    # never interpreted on the rights-holder's behalf). Verdict stamps ride
    # the cards' licenseReview; all forced HIGH via
    # HELD_OUT_BENCHMARK_FAMILIES → relative-only.
    "nusax", "nusatranslation", "menyo20k", "bsd", "nictsap",
    # NOT promoted (landed + buildable, but held out of the open queue):
    #   - arabench: license composition is NOT clearly commercial-safe — it
    #     aggregates MADAR (research-use) + LDC-derived data (the adapter
    #     already excludes the LDC ID-only files); commercial-safety pending
    #     a docs/LICENSING.md review. Ships quarantined, catalogue-only.
    #   - bouquet: gated on HuggingFace + parquet-only; cannot be accessed or
    #     sha-verified here. Ships quarantined until access + schema confirmed.
}


# ---------------------------------------------------------------------------
# Contamination grade policy — force held-out benchmarks to HIGH
# ---------------------------------------------------------------------------
#
# Published / gated held-out benchmark families. A score on any of these is a
# BENCHMARK number, not a measure of real-world translation quality: their test
# sets are public (or gated-but-leaked into web/training corpora), so frontier
# models have very likely memorized them. They are forced to contamination=HIGH
# regardless of the (often optimistic) grade the upstream card declares, so they
# ride the relative-comparison-only lane downstream (mt_eval_harness/
# contamination.py) and can NEVER be read as absolute quality. As a side effect
# they are also excluded from the clean-chaining mesh, which only ever traverses
# positively-LOW edges (generate_sweep_queue._corpus_is_clean).
#
# This is a contamination-POLICY SSOT (which families are held-out benchmarks),
# NOT a language fact, so it lives here next to the promotion list rather than
# being hardcoded per language. It keys off the family token + the corpus's TRUE
# upstream split, never off specific source/target languages.
HELD_OUT_BENCHMARK_FAMILIES = frozenset({
    "flores", "ntrex", "in22", "tico19", "wmt24pp", "alt", "turkicxwmt", "smol",
    # WMT blind test sets 2014–2023 — the OLDER editions (newstest 2014–2021 +
    # General MT 2022–2023). Public for 3–12 years and in essentially every
    # frontier model's training crawl → maximally memorized → forced HIGH
    # (relative-only). NOTE the freshest editions wmt24 / wmt25 are DELIBERATELY
    # absent: they are graded LOW via freshBlindTestSet so they can rank on
    # absolute quality (the whole point — they fix the dev-split ceiling).
    "wmt14", "wmt15", "wmt16", "wmt17", "wmt18",
    "wmt19", "wmt20", "wmt21", "wmt22", "wmt23",
    # AmericasNLP 2021 test set — public since 2021, in essentially every
    # frontier model's training crawl → forced HIGH (relative-only). Redundant
    # with the real_segment="test" rule, kept explicit as belt-and-suspenders.
    "americasnlp2021",
    # Recipe-batch shared tasks (2026-07-07): public since 2020–2022 → forced
    # HIGH (relative-only), same belt-and-suspenders redundancy.
    "mafand", "loresmt2020", "loresmt2021",
    # Recipe batch 2 (2026-07-07): public since 2020–2023 → forced HIGH
    # (relative-only). MENYO-20k is additionally cross-contaminated with
    # MAFAND's yor test set (which derives from it).
    "nusax", "nusatranslation", "menyo20k", "bsd", "nictsap",
})

# A single-corpus eval card declares held-out status on the CARD, not by having
# its id matched against a hardcoded substring here. The previous mechanism was
# `HELD_OUT_BENCHMARK_CARD_MARKERS = ("edtekla",)` — one dataset named in Python,
# which is exactly the "never hardcode language-specific sets in code" rule this
# repo holds everywhere else. Any published, memorizable benchmark sets
# `heldOutBenchmark: true` and is forced HIGH on identical terms; the multiway
# families keep declaring it through HELD_OUT_BENCHMARK_FAMILIES, which keys off
# a family token and never off a language.
HELD_OUT_BENCHMARK_CARD_FIELD = "heldOutBenchmark"


def is_held_out_benchmark(family: str | None,
                          real_segment: str | None,
                          card_id: str = "",
                          *,
                          fresh_blind: bool = False,
                          declared_held_out: bool = False) -> bool:
    """True when a corpus is a published held-out benchmark / test split.

    Data-driven and FAIL SAFE — a corpus is held-out (→ forced HIGH) when ANY
    of these hold:
      * its family token is a known held-out benchmark family, OR
      * its TRUE upstream split is ``test`` (a held-out test split must never be
        a freely-runnable absolute-quality corpus, no matter the family) —
        UNLESS the card is a declared FRESH BLIND test set (see below), OR
      * its card DECLARES ``heldOutBenchmark: true`` (``declared_held_out``).

    ``card_id`` is carried for error messages only — no id is ever pattern-
    matched here. A dataset earns held-out status by what it declares or which
    family it belongs to, never by being the one whose name is written into
    this file.

    ``fresh_blind`` is the ONE narrow, explicit opt-out to the test-split rule.
    A FRESH WMT-style blind test set (e.g. WMT24/25 general) is a held-out
    *test* split whose low contamination comes from FRESHNESS, not from being a
    dev split — calling it HIGH purely because its split is "test" would defeat
    the whole reason it exists (the clean tier that CAN rank absolute quality).
    The opt-out is deliberately weak: it only suppresses the test-split rule, so
    a card that ALSO sits in HELD_OUT_BENCHMARK_FAMILIES (e.g. wmt14..wmt23) or
    declares ``heldOutBenchmark: true`` is STILL forced HIGH. It must be set explicitly on
    the card (``freshBlindTestSet: true``) and is a reviewable assertion that the
    set is recent enough for its honest (LOW/MEDIUM) card grade to govern — it
    can never let an *unlabelled* test split slip into the absolute lane by
    accident, which is what the fail-safe protects against.
    """
    if family and family in HELD_OUT_BENCHMARK_FAMILIES:
        return True
    if (real_segment or "").strip().lower() == "test" and not fresh_blind:
        return True
    return bool(declared_held_out)


def _stamp_license_review(entry: dict, card: dict) -> None:
    """Project the license-review clearance onto a registry entry.

    Both halves travel: the boolean ``licenseReviewed`` (the intake gate's
    clearance flag — a corpus cleared with the flag but no verdict object
    must still leave a trace in the published registry) and the
    ``licenseReview`` verdict object {reviewedAt, verdict, lane, basis}
    when present. One helper, used by the pair path and the multiway
    expansion alike, so the two can never drift.
    """
    if card.get("licenseReviewed"):
        entry["license_reviewed"] = True
    if card.get("licenseReview"):
        entry["license_review"] = card["licenseReview"]


def expand_multiway_card(card: dict, code_bridge: dict) -> list[dict]:
    """Expand a multiway card into per-pair registry entries.

    One multiway card with N languages produces N×(N-1) registry entries —
    one per ordered (source, target) pair where source ≠ target.

    The code bridge maps external source codes (e.g., FLORES 'zho_Hans')
    to project ISO 639-3 codes (e.g., 'cmn-Hans'). Codes not in the
    bridge pass through unchanged — they're assumed to already be ISO 639-3.
    """
    languages = card.get("languages", [])
    gen = card.get("pairGeneration", {})
    source = card.get("source", {})
    download = card.get("download", {})

    # Validate the multiway card's uniform domain against the closed taxonomy
    # (hard-fail on an invalid code or a bare 'mixed'). The multiway domain is a
    # deliberate card fact, NOT classifier output — we never re-classify here.
    # gen_domain / gen_dist are closed over by _make_entry below so every
    # expanded pair (catalogue + promoted) carries the same domain + its
    # per-pair domain_distribution.
    gen_domain = gen.get("domain")
    gen_dist = gen.get("domainDistribution")
    validate_domain(gen_domain, gen_dist, card.get("id", "?"))

    # Determine which code bridge namespace to use
    bridge_namespace = ""
    card_id = card.get("id", "")
    if "flores" in card_id:
        bridge_namespace = "flores"
    elif "ntrex" in card_id:
        bridge_namespace = "ntrex"

    bridge_map = code_bridge.get(bridge_namespace, {})

    # Builder id namespace. flores/ntrex carry code bridges and registered
    # parallel-text builders; other multiway sources (in22, tico19, …) derive
    # their builder id from the card's source token (card_id.split('-')[1]) so
    # the dispatch names the actual source. in22-parallel and tico19-parallel
    # are now implemented + registered in corpus_fetch.REGISTRY_BUILDERS, so
    # these sets are queue-runnable; flores/ntrex remain contaminated catalogue
    # corpora kept out of the queue. An unimplemented builder still fails
    # loudly at fetch time (corpus_fetch raises on unknown builder ids).
    if bridge_namespace:
        builder_ns = bridge_namespace
    else:
        parts = card_id.split("-")
        builder_ns = parts[1] if len(parts) > 1 else "multiway"

    # Promoted multiway test sets enter the runnable lane as
    # segment="development"; everything else keeps its real upstream split and
    # stays catalogue-only. source_export.segment always carries the REAL split
    # so the adapter fetches the right files.
    #
    # SAFETY CONTRACT: "development" here is ONLY a runnable-lane label — it does
    # NOT mean "absolute-quality dev corpus". Almost every promoted family is a
    # held-out benchmark forced to contamination=HIGH below (see
    # is_held_out_benchmark): HIGH puts it on the relative-comparison-only lane
    # and excludes it from the clean-chaining mesh, so promotion makes a memorized
    # test set runnable for method-vs-method comparison while the HIGH grade
    # guarantees it can never be ranked as absolute translation quality.
    #   THE ONE EXCEPTION (2026-06-24): a FRESH BLIND test set — a card declaring
    # freshBlindTestSet=true with an honest LOW/MEDIUM grade (WMT24/25 general).
    # It is promoted AND stays absolute-rankable, because its low contamination
    # comes from freshness, not from being a dev split. This is the
    # "a genuinely-LOW set may also be promoted in future — it would stay
    # absolute-rankable, which is correct" case, now realized for a fresh *test*
    # set. The fail-safe still holds for everything else: an unlabelled test
    # split (no freshBlindTestSet flag) is still forced HIGH, and the older WMT
    # editions stay HIGH via HELD_OUT_BENCHMARK_FAMILIES even with the flag.
    # The TRUE upstream split is always preserved on source_export.segment, so
    # nothing is misrepresented.
    real_segment = gen.get("segment", "devtest")
    entry_segment = (
        "development" if builder_ns in PROMOTED_MULTIWAY_SOURCES
        else real_segment
    )
    # Archive sha pin (the downloaded zip/tarball), propagated to every pair so
    # the fetch path can verify upstream integrity. Per-pair built-file shas
    # stay null for multiway sets (not individually pinned).
    archive_sha = download.get("sha256")
    # Gated-source metadata (additive). When the upstream is gated (e.g. an HF
    # dataset behind accept-terms), carry the exact terms URL and the token env
    # var name through to every pair's source_export so the TUI + fail-honest
    # download errors can render per-dataset accept-terms instructions without
    # re-reading the card.
    gated = bool(download.get("gated"))
    terms_url = download.get("termsUrl")
    token_env = download.get("tokenEnv")
    # HF immutable-commit pin + subset (additive). HF-hosted multiway sources
    # (smol/wmt24pp/bouquet) pin a commit `revision` instead of an archive
    # sha — every file fetched from resolve/{revision}/ is byte-frozen — and
    # SMOL carries a `subset` (smolsent/smoldoc). Both are propagated to each
    # pair's source_export so the standalone harness can build+verify from the
    # registry alone (no card present). Absent for archive sources.
    revision = download.get("revision")
    subset = card.get("subset") or download.get("subset")
    # Contamination grade carried through so the queue/leaderboard can reason
    # about it without re-reading the card (cards use 'risk' or 'level').
    contam = card.get("contamination") or {}
    contam_grade = contam.get("risk") or contam.get("level")
    # Force published held-out benchmarks / true 'test' splits to HIGH
    # (relative-only), overriding any optimistic card grade, so a memorized
    # benchmark score can never be read as absolute quality. Keys off the family
    # token + the TRUE upstream split (real_segment), never per-language. A card
    # may opt out of the test-split rule ONLY by declaring freshBlindTestSet=true
    # (a fresh WMT-style blind set whose honest LOW/MEDIUM grade governs); a
    # family in HELD_OUT_BENCHMARK_FAMILIES is still forced HIGH regardless.
    fresh_blind = bool(card.get("freshBlindTestSet"))
    if is_held_out_benchmark(
            builder_ns, real_segment, card_id, fresh_blind=fresh_blind,
            declared_held_out=bool(card.get(HELD_OUT_BENCHMARK_CARD_FIELD))):
        contam_grade = "HIGH"

    # Card-level variety pins (validated once; every expanded pair whose side
    # carries the pinned macro code resolves through it).
    variety_pins = validate_variety_resolution(card)

    def _make_entry(iso_src, iso_tgt, src_code, tgt_code, size, slug,
                    built_sha=None):
        """Build one per-pair registry entry (shared by all-pairs + explicit).

        ``slug`` is the unique id/path stem. For all-pairs it is
        ``{iso_src}-{iso_tgt}``; for explicit pairs whose upstream codes
        differ from the ISO labels (e.g. WMT24++ ar_EG and ar_SA both → arb)
        it carries the upstream codes so regional variants stay distinct
        corpora on a shared mesh edge instead of colliding on one id.

        ``built_sha`` is the per-pair BUILT-corpus sha256 (the hash of the
        adapter's deterministic output, the one ``corpus_fetch._verify_sha256``
        checks). When a card pins it per explicit pair (SMOL/WMT24++, like
        GlobalVoices/Tatoeba), it surfaces as the entry's top-level ``sha256``
        so the queue's ``corpus_sha256`` is non-null and the pair satisfies the
        sha-pin doctrine that gates the runnable lane. Absent (None) for
        all-pairs sets whose integrity rests on the upstream archive pin.
        """
        export = {
            # Builder dispatch for corpus_fetch. sha256 here is the upstream
            # archive pin (zip/tarball) when present; segment is the REAL split.
            #
            # TRANSPORT vs FAMILY (A1 recipe refactor, 2026-07-07): the builder
            # id names the TRANSPORT implementation. Recipe cards set an
            # explicit download.builder (e.g. "lineparallel") so ONE generic
            # builder serves every recipe benchmark; the FAMILY token
            # (builder_ns — promotion, held-out-contamination, and the built
            # corpus's source_dataset tag all key off it) then rides
            # source_export.family. Cards without the override keep the legacy
            # family-derived builder id and stay byte-identical.
            "builder": f"{download.get('builder') or builder_ns}-parallel",
            "url": download.get("url"),
            "sha256": archive_sha,
            "file_pattern": download.get("filePattern"),
            "format": download.get("format", "parallel-text"),
            "segment": real_segment,
        }
        if revision:
            export["revision"] = revision
        if subset:
            export["subset"] = subset
        if download.get("builder"):
            # Explicit transport override → carry the family token separately
            # (the generic builder stamps it into the built corpus's
            # source_dataset, so it is part of the sha-pinned bytes).
            export["family"] = builder_ns
        if download.get("pairing"):
            # Single-file pairing config (tsv-columns/csv-columns/json-fields;
            # absent = two-file line-zip). Carried verbatim so the harness
            # rebuild pairs exactly what the pin build paired.
            export["pairing"] = download["pairing"]
        # AraBench needs a 2nd archive sha (the split-definition file) — ALT
        # carries it as download.splitSha256; passed through for fetch-time
        # verification when present.
        if download.get("splitSha256"):
            export["split_sha256"] = download["splitSha256"]
        entry = {
            "id": f"{card['id']}-{slug}",
            "name": f"{card['name']} {iso_src}→{iso_tgt}",
            "version": card["version"],
            "language_pair": {"source": iso_src, "target": iso_tgt},
            "size": size,
            "domain": gen_domain,
            "domain_distribution": proportions_to_counts(gen_dist, size),
            "url": None,
            "sha256": built_sha,
            "access": "fetch-from-source",
            "do_not_train": gen.get("doNotTrain", True),
            "license": card.get("license", {}).get("spdx", ""),
            "source": source.get("publisher", ""),
            "path": f"{card['id']}/{slug}.json",
            "segment": entry_segment,
            "notes": card.get("description", ""),
            "attribution": f"{source.get('publisher', '')} ({card.get('license', {}).get('spdx', '')})",
            # Back-reference to the multiway card for fetch-time resolution
            "multiway_card": card["id"],
            # Preserve original source codes for fetch-time file resolution
            "source_codes": {"source": src_code, "target": tgt_code},
            "source_export": export,
        }
        # Contamination grade: label every promoted/merged set so downstream
        # consumers don't have to re-read the card.
        if contam_grade:
            entry["contamination"] = contam_grade
        # Gated-source metadata — only emitted when the upstream is gated, so
        # non-gated entries stay byte-identical to before.
        if gated:
            entry["gated"] = True
            export["gated"] = True
            if terms_url:
                entry["terms_url"] = terms_url
                export["terms_url"] = terms_url
            if token_env:
                entry["token_env"] = token_env
                export["token_env"] = token_env
        # Card-level quarantine flows to every expanded pair (e.g. BOUQuET is
        # catalogued but not runnable until access/schema are verified).
        if card.get("quarantine"):
            entry["quarantine"] = True
            if card.get("quarantineReason"):
                entry["quarantine_reason"] = card["quarantineReason"]
        # The license-review stamp flows to every expanded pair for the same
        # reason quarantine does: each directed pair is what the queue, board
        # and docs actually consume.
        _stamp_license_review(entry, card)
        # Card-level transmission policy/consent flows to every expanded pair.
        if card.get("transmissionPolicy"):
            entry["transmission_policy"] = card["transmissionPolicy"]
        if card.get("transmissionConsent"):
            entry["transmission_consent"] = card["transmissionConsent"]
        # Language-code resolution stamp (Position 4 v2).
        attach_language_resolution(entry, variety_pins)
        return entry

    seen_pairs = set()
    entries = []

    explicit_pairs = gen.get("explicitPairs")
    if explicit_pairs:
        # Explicit-pair mode (directed / curated sets: WMT24++ eng→xx, SMOL
        # per-file directed pairs, AraBench dialect↔eng). Each pair declares
        # its project ISO codes, the upstream file codes (srcCode/tgtCode), and
        # optionally its own size. This avoids the all-pairs explosion for
        # sets that are NOT genuinely N-way parallel.
        for p in explicit_pairs:
            iso_src, iso_tgt = p["source"], p["target"]
            if iso_src == iso_tgt:
                continue
            src_code = p.get("srcCode", iso_src)
            tgt_code = p.get("tgtCode", iso_tgt)
            # Disambiguate id/path by the upstream codes when they differ from
            # the ISO labels, so regional variants that map to the same ISO
            # pair (e.g. ar_EG and ar_SA → arb) stay distinct corpora rather
            # than collide on one id. Dedup by the resulting unique slug.
            if (src_code, tgt_code) == (iso_src, iso_tgt):
                slug = f"{iso_src}-{iso_tgt}"
            else:
                slug = f"{iso_src}-{iso_tgt}__{src_code}-{tgt_code}"
            if slug in seen_pairs:
                continue
            seen_pairs.add(slug)
            # Per-pair pins propagated to the entry: ``size`` (the real built
            # entry_count, enforced by the fetch wrapper) and ``sha256`` (the
            # built-corpus hash, surfaced as the entry's top-level sha256 so the
            # queue's corpus_sha256 is non-null). SMOL/WMT24++ pin both per pair
            # (pin_smol_wmt24pp_pairs.py); a card that leaves them off (size 0 /
            # sha null) still expands — its integrity then rests on the upstream
            # archive/revision pin alone (e.g. AraBench, kept quarantined).
            entry = _make_entry(
                iso_src, iso_tgt, src_code, tgt_code,
                p.get("size", 0), slug, built_sha=p.get("sha256"),
            )
            # Per-pair transport overrides (recipe cards): direction-specific
            # file patterns and explicit member paths (upstream filename
            # irregularities) ride the pair → the entry, so fetch-time
            # rebuilds resolve the exact members the pin build used.
            if p.get("filePattern"):
                entry["source_export"]["file_pattern"] = p["filePattern"]
            if p.get("srcMember"):
                entry["source_export"]["src_member"] = p["srcMember"]
            if p.get("tgtMember"):
                entry["source_export"]["tgt_member"] = p["tgtMember"]
            entries.append(entry)
        return entries

    # All-pairs mode (genuinely N-way parallel sets: FLORES/NTREX/TICO-19/
    # IN22/ALT/Turkic). One card with N languages → N×(N-1) ordered pairs.
    # ``sizePerPair`` is the uniform/default size; ``pairSizes`` (optional)
    # overrides it per direction for sets whose directions are NOT all the same
    # length (e.g. Turkic X-WMT — 300–1000 sentences/direction). Keyed by the
    # generated slug ``{iso_src}-{iso_tgt}``, so the registry carries each
    # direction's TRUE entry_count, which the fetch path enforces.
    size_per_pair = gen.get("sizePerPair", 0)
    pair_sizes = gen.get("pairSizes") or {}
    for src_code in languages:
        iso_src = bridge_map.get(src_code, src_code)
        for tgt_code in languages:
            if src_code == tgt_code:
                continue
            iso_tgt = bridge_map.get(tgt_code, tgt_code)
            # Skip self-pairs after mapping (e.g., zho_Hans→cmn, zho_Hant→cmn)
            if iso_src == iso_tgt:
                continue
            pair_key = (iso_src, iso_tgt)
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)
            slug = f"{iso_src}-{iso_tgt}"
            entries.append(_make_entry(
                iso_src, iso_tgt, src_code, tgt_code,
                pair_sizes.get(slug, size_per_pair), slug,
            ))

    # --- Curated promotion subset (data-driven: card.promotedSubset) ---
    # A contaminated multiway catalogue (FLORES+) is catalogue-only by default
    # (segment=devtest, excluded from registry.json + the queue). The card may
    # promote a curated language slice into the RUNNABLE lane: those pairs get
    # segment="development", their EXACT upstream file codes in source_codes
    # (so the builder resolves the right files — e.g. project ISO 'que' →
    # FLORES 'quy_Latn', Ayacucho Quechua), the pinned immutable revision, and a
    # per-pair built sha. They still carry the card's HIGH contamination grade,
    # so they ride the relative-comparison-only lane downstream. Promoted pairs
    # REPLACE their catalogue twins (dedup by id) so each pair appears once.
    promoted = card.get("promotedSubset") or {}
    promoted_langs = promoted.get("languages") or []
    if promoted_langs:
        promoted_code = {p["iso"]: p.get("sourceCode", p["iso"]) for p in promoted_langs}
        promoted_variety = {p["iso"]: p["variety"]
                            for p in promoted_langs if p.get("variety")}
        built_shas = promoted.get("builtShas") or {}
        prom_revision = promoted.get("revision") or revision
        prom_size = promoted.get("sizePerPair") or size_per_pair
        promoted_entries = []
        prom_ids = set()
        for iso_src in promoted_code:
            for iso_tgt in promoted_code:
                if iso_src == iso_tgt:
                    continue
                slug = f"{iso_src}-{iso_tgt}"
                e = _make_entry(
                    iso_src, iso_tgt,
                    promoted_code[iso_src], promoted_code[iso_tgt],
                    prom_size, slug, built_sha=built_shas.get(slug),
                )
                # Promote into the runnable lane and pin the immutable revision
                # (the per-pair built sha is reproducible only against it).
                e["segment"] = "development"
                if prom_revision:
                    e["source_export"]["revision"] = prom_revision
                # Self-document the variety on the entry (e.g. Ayacucho quy),
                # so the runnable corpus is unambiguous without the card.
                note_bits = []
                if promoted_variety.get(iso_src):
                    note_bits.append(f"source: {promoted_variety[iso_src]}")
                if promoted_variety.get(iso_tgt):
                    note_bits.append(f"target: {promoted_variety[iso_tgt]}")
                if note_bits:
                    e["notes"] = (e.get("notes", "") + "  [" + "; ".join(note_bits) + "]").strip()
                promoted_entries.append(e)
                prom_ids.add(e["id"])
        entries = [e for e in entries if e.get("id") not in prom_ids]
        entries.extend(promoted_entries)

    return entries


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_card(card: dict, card_name: str) -> list[str]:
    """Validate sovereignty consistency rules on a card.

    Returns a list of error messages. Empty list = card is valid.
    These rules enforce consistency between sovereignty-related fields
    that the JSON schema alone can't express (cross-field constraints).
    """
    errors = []
    card_id = card.get("id", card_name)

    # Rule 1: doNotTrain and usageRestrictions.training must be consistent.
    do_not_train = card.get("doNotTrain")
    usage = card.get("usageRestrictions") or {}
    training = usage.get("training")
    if do_not_train and training == "permitted":
        errors.append(
            f"{card_id}: doNotTrain=true but usageRestrictions.training='permitted' "
            f"— these are contradictory. If eval data shouldn't be trained on, "
            f"training can't be 'permitted'."
        )

    # Rule 2: Cards invoking a community data-sovereignty framework should
    # not have training='permitted'. ("community-ownership-control" is the
    # card-vocabulary token from the corpora-card schema.)
    sovereignty = card.get("sovereignty") or {}
    frameworks = sovereignty.get("frameworks", [])
    if "community-ownership-control" in frameworks and training == "permitted":
        errors.append(
            f"{card_id}: sovereignty.frameworks declares a community "
            f"data-sovereignty framework but usageRestrictions.training="
            f"'permitted' — sovereignty-governed data should have "
            f"community-asserted training restrictions."
        )

    # Rule 3: Active secretTest requires stewardship with ≥5 stewards.
    secret_test = card.get("secretTest")
    if secret_test and secret_test.get("status") == "active":
        stewardship = card.get("stewardship") or {}
        stewards = stewardship.get("stewards", [])
        if len(stewards) < 5:
            errors.append(
                f"{card_id}: secretTest.status='active' but only "
                f"{len(stewards)} stewards (need ≥5). Prize corpora with "
                f"active secret sets require 5+ stewards for TSS custody."
            )
        if not stewardship.get("threshold"):
            errors.append(
                f"{card_id}: secretTest.status='active' but stewardship.threshold "
                f"is not set. Must specify TSS threshold (e.g., '3 of 5')."
            )

    return errors


# ---------------------------------------------------------------------------
# Buildability gate — the registry may not advertise corpora it can't serve
# ---------------------------------------------------------------------------
#
# The promise this gate enforces: *every corpus that can reach the public
# queue must be buildable or already present on disk.* A silent
# access:"local" entry pointing at a file that isn't there, or a
# fetch-from-source entry naming a builder the harness doesn't implement,
# is exactly the "looks registered but can't run" failure we refuse to ship.
# Errors block the build (exit 1). Catalogue-only corpora (contaminated
# multiway test sets, quarantined sets) are never queue-eligible, so their
# build gaps are reported as warnings rather than hard failures.


def registered_builders() -> set:
    """Builder ids the harness can actually dispatch (the SSOT for fetch).

    Imported live from ``mt_eval_harness.corpus_fetch`` so the registry can
    never claim a builder that has no implementation. We refuse to build a
    registry we cannot validate — a missing import is fatal, not skipped.
    """
    arena_dir = REPO_ROOT / "arena"
    if str(arena_dir) not in sys.path:
        sys.path.insert(0, str(arena_dir))
    try:
        from mt_eval_harness import corpus_fetch
    except Exception as exc:
        raise SystemExit(
            f"FATAL: cannot import mt_eval_harness.corpus_fetch to validate "
            f"builder ids ({exc}). build_registry refuses to run without the "
            f"harness's builder registry — fix the import before building."
        )
    return set(corpus_fetch.BUILDERS) | set(corpus_fetch.REGISTRY_BUILDERS)


def _entry_is_queue_eligible(entry: dict) -> bool:
    """Mirror of generate_sweep_queue.queue_corpora's eligibility test.

    Kept deliberately in sync: the gate's whole promise is "if an entry can
    reach the queue, it must be buildable", so it must judge eligibility the
    same way the queue does.

    Deliberate over-inclusion (2026-07-19): queue_corpora additionally
    excludes transmission consent-required/sealed corpora (founder channel
    rule — mt_eval_harness.transmission_policy). This mirror does NOT — a
    consent-gated corpus must still be buildable, because a recorded
    consent grant makes it queueable with no registry rebuild. Stricter
    here is safe; only under-inclusion would break the gate's promise.
    """
    if entry.get("quarantine"):
        return False
    access = entry.get("access")
    if access == "fetch-from-source":
        if not isinstance(entry.get("source_export"), dict):
            return False
    elif access != "local":
        return False
    if entry.get("segment") != "development":
        return False
    if "NC" in (entry.get("license") or "").upper():
        return False
    if not entry.get("path"):
        return False
    return True


def _local_file_exists(entry: dict) -> bool:
    """True when an access:local entry's content file is present on disk."""
    path = entry.get("path")
    if not path:
        return False
    candidates = [
        REGISTRY_DIR / path,
        REGISTRY_DIR / "curated" / Path(path).name,
        REPO_ROOT / path,
    ]
    return any(p.is_file() for p in candidates)


def gate_entries(source_entries: dict, known_builders: set):
    """Loud integrity gate over generated registry entries.

    Returns ``(errors, catalogue_gaps, quarantined)``:
        errors          — list[str]; queue-eligible entries that can't be
                          built/loaded. ANY of these blocks the build.
        catalogue_gaps  — dict[(source, reason, detail) -> count]; non-queue
                          catalogue corpora (e.g. contaminated multiway) with
                          no working builder. Reported, not fatal.
        quarantined     — dict[source -> count]; explicitly shelved corpora.
    """
    errors: list[str] = []
    catalogue: dict = {}
    quarantined: dict = {}

    for source, entries in source_entries.items():
        for e in entries:
            eid = e.get("id", "?")
            if e.get("quarantine"):
                quarantined[source] = quarantined.get(source, 0) + 1
                continue

            access = e.get("access")
            problem = None  # (reason, detail)
            if access == "fetch-from-source":
                builder = (e.get("source_export") or {}).get("builder")
                if not builder:
                    problem = ("missing source_export.builder", None)
                elif builder not in known_builders:
                    problem = ("unregistered builder", builder)
            elif access == "local":
                if not _local_file_exists(e):
                    problem = ("missing local content file", e.get("path"))
            else:
                problem = ("unexpected access mode", access)

            if problem is None:
                continue
            reason, detail = problem
            if _entry_is_queue_eligible(e):
                errors.append(
                    f"  ✗ {eid}: {reason}"
                    + (f" '{detail}'" if detail else "")
                    + "  — this corpus is QUEUE-ELIGIBLE and MUST be buildable."
                )
            else:
                key = (source, reason, detail)
                catalogue[key] = catalogue.get(key, 0) + 1

    return errors, catalogue, quarantined


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not CARDS_DIR.exists():
        print(f"ERROR: Cards directory not found: {CARDS_DIR}")
        sys.exit(1)

    code_bridge = load_code_bridge()

    # Load all cards (eval + multiway), skip reference cards
    eval_cards = []
    multiway_cards = []
    self_pair_cards = []  # source == target — invalid for translation eval

    for card_path in sorted(CARDS_DIR.glob("*.json")):
        try:
            card = json.loads(card_path.read_text(encoding="utf-8"))
            card_type = card.get("type")
            if card_type == "eval":
                pair = card.get("pair") or {}
                if pair.get("source") and pair.get("source") == pair.get("target"):
                    # A same-language "translation" pair is not a translation
                    # direction: it would be a self-loop in the mesh and a
                    # meaningless queue item. Exclude it from every registry
                    # rather than let it pollute the queue / crash the mesh.
                    self_pair_cards.append(card.get("id", card_path.name))
                    continue
                eval_cards.append(card)
            elif card_type == "multiway":
                multiway_cards.append(card)
            # reference cards are skipped — they don't produce registry entries
        except (json.JSONDecodeError, KeyError) as e:
            print(f"  WARN Skipping {card_path.name}: {e}")

    print(f"Found {len(eval_cards)} eval cards, {len(multiway_cards)} multiway cards in {CARDS_DIR}")

    if self_pair_cards:
        print(
            f"\nEXCLUDED {len(self_pair_cards)} self-pair card(s) "
            f"(source == target — not a valid translation direction). These "
            f"are not emitted to any registry; delete the cards to silence "
            f"this notice:"
        )
        for cid in sorted(self_pair_cards):
            print(f"  ⚠ {cid}")

    # Validate sovereignty consistency rules on eval cards
    all_errors = []
    for card in eval_cards:
        card_errors = validate_card(card, card.get("id", "unknown"))
        all_errors.extend(card_errors)

    if all_errors:
        print(f"\nSOVEREIGNTY VALIDATION ERRORS ({len(all_errors)}):")
        for err in all_errors:
            print(f"  ✗ {err}")
        print("\nFix the cards above before rebuilding the registry.")
        sys.exit(1)
    else:
        print("Sovereignty validation: OK")

    # --- Build per-source registry entries ---
    # Group eval card entries by their registry source
    source_entries: dict[str, list[dict]] = {}

    for card in eval_cards:
        source = classify_registry_source(card)
        entry = card_to_registry_entry(card)
        source_entries.setdefault(source, []).append(entry)

    # Expand multiway cards and add their entries
    for card in multiway_cards:
        source = classify_registry_source(card)
        entries = expand_multiway_card(card, code_bridge)
        source_entries.setdefault(source, []).extend(entries)
        print(f"  Expanded multiway card '{card['id']}' → {len(entries)} entries → registry-{source}.json")

    # --- Buildability gate: refuse to advertise corpora we can't serve ---
    known_builders = registered_builders()
    errors, catalogue_gaps, quarantined = gate_entries(source_entries, known_builders)

    if quarantined:
        total_q = sum(quarantined.values())
        print(f"\nQuarantined (catalogued, explicitly NOT runnable) — {total_q} entries:")
        for src, n in sorted(quarantined.items()):
            print(f"  ⚠ registry-{src}.json: {n} quarantined")

    if catalogue_gaps:
        total_c = sum(catalogue_gaps.values())
        print(f"\nCatalogue-only build gaps (NOT queue-eligible, e.g. contaminated "
              f"multiway) — {total_c} entries:")
        for (src, reason, detail), n in sorted(catalogue_gaps.items()):
            d = f" '{detail}'" if detail else ""
            print(f"  ⚠ registry-{src}.json: {n}× {reason}{d}")

    if errors:
        print(f"\nBUILDABILITY GATE FAILED — {len(errors)} queue-eligible "
              f"corpora cannot be built or loaded:")
        for err in errors:
            print(err)
        print("\nA corpus that can reach the public queue MUST be runnable. "
              "Fix the card (recipe/builder) or mark it quarantine:true before "
              "rebuilding.")
        sys.exit(1)
    print("\nBuildability gate: OK — every queue-eligible corpus is buildable.")

    # --- Output ---
    total_entries = sum(len(entries) for entries in source_entries.values())

    if DRY_RUN:
        print(f"\nDry run — would write {total_entries} entries across {len(source_entries)} registry files:")
        for source, entries in sorted(source_entries.items()):
            print(f"  registry-{source}.json: {len(entries)} entries")
        return

    if SHOW_DIFF:
        # Compare against legacy single-file registry if it exists
        if LEGACY_REGISTRY_PATH.exists():
            import difflib
            old = LEGACY_REGISTRY_PATH.read_text(encoding="utf-8").splitlines()

            # Build a merged view for comparison
            merged = {"registry_version": "3.0.0", "datasets": []}
            for entries in source_entries.values():
                merged["datasets"].extend(entries)
            new = json.dumps(merged, indent=2, ensure_ascii=False).splitlines()

            diff = difflib.unified_diff(
                old, new,
                fromfile="registry.json (current)",
                tofile="registry-*.json (rebuilt, merged view)",
                lineterm="",
            )
            diff_lines = list(diff)
            if diff_lines:
                # Show first 100 lines to avoid overwhelming output
                for line in diff_lines[:100]:
                    print(line)
                if len(diff_lines) > 100:
                    print(f"... ({len(diff_lines) - 100} more diff lines)")
            else:
                print("No changes.")
        else:
            print("No legacy registry.json to diff against.")
        return

    # Write split registry files
    for source, entries in sorted(source_entries.items()):
        registry = {
            "registry_version": "3.0.0",
            "_generated": (
                f"Built from cli/shared/corpora-cards/ by build_registry.py. "
                f"DO NOT EDIT — edit the corpora cards instead. "
                f"Source: {source}."
            ),
            "datasets": entries,
        }
        output_path = REGISTRY_DIR / f"registry-{source}.json"
        output = json.dumps(registry, indent=2, ensure_ascii=False) + "\n"
        output_path.write_text(output, encoding="utf-8")
        print(f"  Wrote registry-{source}.json: {len(entries)} entries")

    # Write the merged single-file registry.json — the current dev/runnable
    # registry (every development-segment entry across all sources, tagged
    # with registry_source). This is what the legacy single-file consumers
    # read: load_registry()'s single-file mode, generate_sweep_queue,
    # lint_run_reports, and corpus_fetch's registry fallback. Regenerating it
    # from the cards is what stops those consumers from going stale.
    #
    # Inclusion is by segment="development" (the runnable-lane label).
    # Multiway sets are promoted into this lane by expand_multiway_card
    # (see PROMOTED_MULTIWAY_SOURCES), so their pairs land here, in the
    # queue, and — clean sets only — in the mesh. FLORES/NTREX
    # (founder decision 2026-08-27): admitted through their cards'
    # promotedSubset (built + sha-pinned pairs — FLORES currently 870;
    # forced HIGH → relative-only); the unbuilt catalogue tail stays in
    # the split files until a batch build pins its shas.
    # SIZE CEILING (noted 2026-08-27): a full flores+ntrex promotion once
    # pushed this file — tracked in git, served at champollion.dev/
    # registry.json, bundled into the pip wheel — to 121 MB, past the
    # 100 MB ceiling. Inclusion stays segment-driven; keep catalogue-scale
    # sources out of the runnable lane except through curated
    # promotedSubset slices (built + sha-pinned), which stay compact.
    merged_datasets = []
    for source, entries in sorted(source_entries.items()):
        for e in entries:
            if e.get("segment") == "development":
                tagged = dict(e)
                tagged["registry_source"] = source
                merged_datasets.append(tagged)
    merged = {
        "registry_version": "3.0.0",
        "_generated": (
            "Built from cli/shared/corpora-cards/ by build_registry.py. "
            "DO NOT EDIT — edit the corpora cards instead. Merged "
            "development-segment (runnable) registry; contaminated multiway "
            "catalogue lives only in registry-*.json split files."
        ),
        "datasets": merged_datasets,
    }
    merged_json = json.dumps(merged, indent=2, ensure_ascii=False) + "\n"
    LEGACY_REGISTRY_PATH.write_text(merged_json, encoding="utf-8")
    print(f"  Wrote registry.json (merged dev/runnable): {len(merged_datasets)} entries")

    # Bundled copy inside the package — what a `pip install`ed harness ships
    # with when there's no monorepo (config.load_registry step 3). Same content.
    BUNDLED_REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    BUNDLED_REGISTRY_PATH.write_text(merged_json, encoding="utf-8")
    print(f"  Wrote {BUNDLED_REGISTRY_PATH.relative_to(REPO_ROOT)} (bundled fallback)")

    print(f"\nTotal: {total_entries} entries across {len(source_entries)} split "
          f"files + {len(merged_datasets)} in the merged registry.json")


if __name__ == "__main__":
    main()
