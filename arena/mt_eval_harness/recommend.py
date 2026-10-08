"""
Method recommendation for a language pair — the routing evidence surface.

``mt-eval recommend SRC TGT`` answers the practical question a translator-
integrator actually has: *"I need to translate SRC→TGT — what are my options,
what does the published evidence say, and what can I actually run right
now?"* — while refusing to overclaim (master-plan workstream E4, founder
directive 2026-07-07).

Three evidence tiers are consulted, all offline (shared/ artifacts — no
network, no credentials):

  1. **Dispatchable methods** — ``shared/method-registry.json`` (the
     cross-runtime SSOT): every engine/provider the harness or the champollion
     CLI can invoke, with per-method AVAILABILITY resolved live (is its API
     key in the environment? is it harness-only? is its license commercial-
     ready?) and COVERAGE of the pair from the recorded publisher lists — the
     language card's methodSupport (through the card adapter, which in a
     standalone install fetches the card like every other card read) and
     ``shared/catalogue/method-coverage.json``. A method either list records
     as not covering the pair is UNSUPPORTED, never READY; a runnable method
     no record confirms for the pair is UNVERIFIED, so READY means "known to
     cover it".
  2. **Curated cited results** — ``shared/catalogue/external-results.json``:
     hand-verified published datapoints (cited ≠ reproduced), direction-exact.
  3. **Bulk cited results** — ``shared/catalogue/external-mt-index.json``:
     the machine-imported best-published-score index (OPUS-MT leaderboard
     family), RELATIVE-ONLY lane by construction.

HONESTY CONTRACT (the whole point):
  * Cited evidence orders methods *relative to each other on a memorized
    public benchmark* — it is never absolute quality and never a deployment
    ranking. Every rendered section says so (contamination.py lanes).
  * Evidence and dispatchability are DIFFERENT axes: the best-evidenced model
    for a pair (say NLLB-200) may not be runnable in Champollion, and may be
    NC-licensed (weights CC-BY-NC → excluded from commercial-lane
    recommendations). The output keeps "best evidenced" and "runnable now"
    visibly separate and joins them only with explicit caveats.
  * No evidence → say exactly that, and point at the runnable corpora
    (``mt-eval corpora``) so the user can MEASURE rather than guess. An
    honest "we don't know" beats a fabricated ranking.
  * Standalone pip installs may lack the shared/ artifacts — each tier
    degrades to an explicit "not available" note, never silently.

This module is pure logic over the shared artifacts; loaders take explicit
paths so tests can inject fixtures.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from mt_eval_harness.contamination import (
    LANE_RELATIVE_ONLY,
    lane_for_grade,
    normalize_grade,
)
from mt_eval_harness.method_manifest import load_method_manifest

_PACKAGE_DIR = Path(__file__).resolve().parent


# ---------------------------------------------------------------------------
# Shared-artifact resolution (mirrors method_manifest.manifest_path)
# ---------------------------------------------------------------------------

def catalogue_path(filename: str) -> Path | None:
    """Find shared/catalogue/<filename> by walking up from the package.

    Returns None in a standalone install — callers render an explicit
    "index not available" note, never a silent skip.
    """
    check = _PACKAGE_DIR
    for _ in range(6):
        candidate = check / "shared" / "catalogue" / filename
        if candidate.exists():
            return candidate
        check = check.parent
    # An installed wheel ships the three evidence indexes recommend reads
    # (data/catalogue/, byte-identical to shared/catalogue/ — enforced by
    # tests/test_bundled_shared.py). Without them a pip install's recommend
    # had no methods, no evidence and no metric-trust tier.
    bundled = _PACKAGE_DIR / "data" / "catalogue" / filename
    return bundled if bundled.exists() else None


def _load_json(path: Path | None) -> dict | None:
    if path is None:
        return None
    return json.loads(path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Tier 1 — dispatchable methods + live availability
# ---------------------------------------------------------------------------

def resolve_availability(entry: dict, env: dict[str, str] | None = None) -> dict:
    """Resolve one method-registry entry to a live availability verdict.

    Returns {status, detail} where status ∈:
      ready        — invocable right now (needed credential(s) present, or none needed)
      needs-key    — adapter exists; set the named env var(s)
      local-setup  — local engine; needs the optional install/extra

    Readiness is judged on the entry's CREDENTIAL vars only: ``credential_env``
    when declared, else the full ``env`` list. The registry ``env`` list also
    names non-credential config vars (AWS_REGION, *_ENDPOINT) the adapter
    reads — those must never make a method read "ready" (a region is not
    auth). ``credential_env_all: true`` marks key-pair auth: EVERY credential
    var is required (AWS access-key id + secret, Lara id + secret), where the
    default any-of semantics fit alias lists (canonical key or its alias).
    """
    env = os.environ if env is None else env
    cred_vars = entry.get("credential_env")
    check_vars = cred_vars if cred_vars is not None else (entry.get("env") or [])
    need_all = bool(entry.get("credential_env_all"))
    kind = entry.get("kind", "")
    extra = entry.get("optional_extra")
    extra_note = f" (requires pip extra '{extra}')" if extra else ""

    if kind == "local-model":
        return {
            "status": "local-setup",
            "detail": f"local engine — install extra '{extra}'" if extra
                      else "local engine — see homepage for setup",
        }
    if not check_vars:
        return {"status": "ready",
                "detail": "no credentials required" + extra_note}
    present = [v for v in check_vars if env.get(v)]
    # A KEYLESS method (registry ``keyless: true``: a server on this machine,
    # a free public API) needs nothing set — its env vars only point
    # elsewhere. Reporting them as a missing key told people the private,
    # local option needed credentials. Mirrors cli/lib/recommend.js.
    if entry.get("keyless"):
        base = entry.get("default_base_url") or "its default endpoint"
        return {"status": "ready",
                "detail": (f"{present[0]} is set" if present else
                           f"no key needed — uses {base} unless "
                           f"{check_vars[0]} points elsewhere") + extra_note}
    if need_all:
        missing = [v for v in check_vars if not env.get(v)]
        if not missing:
            return {"status": "ready",
                    "detail": " + ".join(check_vars) + " are set" + extra_note}
        qualifier = (f" ({present[0]} alone is not enough)" if present
                     else " (all required)")
        return {"status": "needs-key",
                "detail": "set " + " + ".join(missing) + qualifier + extra_note}
    if present:
        return {"status": "ready", "detail": f"{present[0]} is set" + extra_note}
    return {
        "status": "needs-key",
        "detail": "set " + " or ".join(check_vars) + extra_note,
    }


def card_method_support(code: str, method: str, errors: list[str] | None = None) -> bool | None:
    """The language card's verdict, read through the card adapter
    (language_cards.get_card → the flat ``methodSupport`` map) — twin of
    cli/lib/registers.js isMethodSupported, the verdict both runtimes' card
    surfaces print. True/False only for a service the card indexes (its flat
    keys are the registry names in camelCase: googleTranslate ↔
    google-translate); None when the card says nothing. An unavailable card
    index is recorded in ``errors`` (when given), never a crash."""
    from mt_eval_harness import language_cards
    from mt_eval_harness.language_cards_remote import LanguageCardsUnavailable
    try:
        card = language_cards.get_card(code)
    except LanguageCardsUnavailable as exc:
        if errors is not None and not errors:
            errors.append(str(exc))
        return None
    flat = (card or {}).get("methodSupport")
    if not isinstance(flat, dict):
        return None
    norm = lambda s: "".join(ch for ch in s.lower() if ch.isalnum())  # noqa: E731
    entry = next((v for k, v in flat.items() if norm(k) == norm(method)), None)
    supported = entry.get("supported") if isinstance(entry, dict) else None
    return supported if isinstance(supported, bool) else None


def language_coverage(name: str, code: str, catalogue: dict | None, card_support) -> dict:
    """What the RECORDED publisher lists say about one language for one
    method — twin of cli/lib/recommend.js languageCoverage. Both records are
    read, never one picked: the language card (card_method_support) and
    shared/catalogue/method-coverage.json. All agree listed → 'listed'; all
    say not → 'not-listed'; they disagree → 'disputed' (both named). "Not
    indexed" is said ONLY when nothing is recorded — the card printed
    "apertium ✗ unsupported" for Plains Cree while this said "not indexed"."""
    records = []
    on_card = card_support(code, name) if card_support else None
    if isinstance(on_card, bool):
        records.append(("language card", on_card))
    rec = next((m for m in (catalogue or {}).get("methods", []) if m.get("key") == name), None)
    langs = rec.get("iso6393") if rec and isinstance(rec.get("iso6393"), list) else []
    if langs:
        records.append(("method-coverage.json",
                        code in langs or code.split("_", 1)[0] in langs))
    if not records:
        return {"coverage": "unknown",
                "note": ("the publisher states a language count, not a list" if rec
                         else "language coverage not indexed — check the service")}
    yes = " + ".join(s for s, listed in records if listed)
    no = " + ".join(s for s, listed in records if not listed)
    if not no:
        return {"coverage": "listed", "note": f"{code} is in its published language list ({yes})"}
    if not yes:
        return {"coverage": "not-listed",
                "note": f"{code} is NOT in its published language list ({no})"}
    return {"coverage": "disputed",
            "note": f"the records disagree on {code}: listed per {yes}, NOT listed per {no} "
                    f"— check the service"}


def pair_coverage(name: str, entry: dict, src: str | None, tgt: str,
                  catalogue: dict | None, card_support=None) -> dict:
    """Does this method cover the PAIR? From the recorded publisher lists,
    never guessed. Mirrors cli/lib/recommend.js pairCoverage: "ready" only
    ever meant "no key missing", and read as "works for your language" (Round
    1, hospital). A language a list-based service does not list cannot be
    translated FROM either, so the source side is read too.
    Returns {"target": {...}, "source": {...} | None}."""
    if entry.get("kind") == "llm-provider" or entry.get("paradigm") == "llm":
        anyl = {"coverage": "any",
                "note": "takes text in any language — quality for this one is unmeasured"}
        return {"target": anyl, "source": anyl if src else None}
    if entry.get("kind") == "local-model":
        dep = {"coverage": "unknown", "note": "depends on the model you load"}
        return {"target": dep, "source": dep if src else None}
    return {"target": language_coverage(name, tgt, catalogue, card_support),
            "source": language_coverage(name, src, catalogue, card_support) if src else None}


def dispatchable_methods(
    use_context: str,
    manifest: dict | None = None,
    env: dict[str, str] | None = None,
    tgt: str | None = None,
    coverage: dict | None = None,
    src: str | None = None,
    card_support=None,
) -> list[dict]:
    """Tier-1 rows: every registry method with availability + lane verdicts.

    ``use_context`` ∈ {'non-commercial', 'commercial'}: the commercial lane
    is STRICT (mirrors license_use.py) — a method whose ``commercialReady``
    is not True is excluded-with-reason, never silently dropped.

    With a target, ``availability`` is the verdict for the PAIR: a method a
    recorded list says does not cover either side is 'unsupported' — never
    'ready' — and the credential verdict stays as ``key_availability``.
    Runnable on keys alone but coverage of either side not confirmed
    (nothing recorded, a count instead of a list, or records that disagree)
    is 'unverified': 'ready' means known to cover the pair (Round 5,
    hospital persona: Apertium READY for English→Ayta, coverage "not
    indexed"). It sorts right after 'ready'. Twin of cli/lib/recommend.js.
    ``card_support(code, method) -> bool | None`` defaults to the card adapter
    (card_method_support).
    """
    manifest = manifest if manifest is not None else load_method_manifest()
    if not manifest:
        return []
    if tgt and coverage is None:
        coverage = _load_json(catalogue_path("method-coverage.json"))
    card_support = card_support if card_support is not None else card_method_support
    rows = []
    for name, entry in (manifest.get("entries") or {}).items():
        avail = resolve_availability(entry, env=env)
        cov = pair_coverage(name, entry, src, tgt, coverage, card_support) if tgt else None
        not_covered = [c for c in ((cov["source"], cov["target"]) if cov else ())
                       if c and c["coverage"] == "not-listed"]
        unconfirmed = [c for c in ((cov["source"], cov["target"]) if cov else ())
                       if c and c["coverage"] in ("unknown", "disputed")]
        availability = ("unsupported" if not_covered
                        else "unverified" if avail["status"] == "ready" and unconfirmed
                        else avail["status"])
        runtimes = entry.get("runtimes") or ["harness", "cli"]
        lane_ok = True
        lane_note = None
        if use_context == "commercial" and entry.get("commercialReady") is not True:
            lane_ok = False
            lane_note = (f"excluded from the commercial lane — "
                         f"license: {entry.get('license', 'unknown')}")
        rows.append({
            "method": name,
            "kind": entry.get("kind"),
            "paradigm": entry.get("paradigm"),
            "license": entry.get("license"),
            "commercial_ready": bool(entry.get("commercialReady")),
            "runtimes": runtimes,
            "availability": availability,
            "availability_detail": ("; ".join(c["note"] for c in not_covered)
                                    if not_covered else avail["detail"]),
            "key_availability": avail["status"],
            "key_availability_detail": avail["detail"],
            "lane_ok": lane_ok,
            "lane_note": lane_note,
            "cost_note": entry.get("cost_note"),
            **({"target_coverage": cov["target"]["coverage"],
                "target_coverage_note": cov["target"]["note"]} if cov else {}),
            **({"source_coverage": cov["source"]["coverage"],
                "source_coverage_note": cov["source"]["note"]}
               if cov and cov["source"] else {}),
        })
    order = {"ready": 0, "unverified": 1, "needs-key": 2, "local-setup": 3, "unsupported": 4}
    rows.sort(key=lambda r: (not r["lane_ok"], order.get(r["availability"], 9),
                             r["method"]))
    return rows


# ---------------------------------------------------------------------------
# Tier 1b — open models a model card declares for the target
# ---------------------------------------------------------------------------

#: Weight formats the local-model engine does not load from a Hugging Face id
#: — twin of NOT_LOADABLE_BY_LOCAL_MODEL in cli/lib/recommend.js (keep the two
#: identical; the parity test runs both): a quantized or ONNX export, an
#: adapter, or a CTranslate2 conversion on the Hub (local-model reads CT2 only
#: from a directory on this machine).
NOT_LOADABLE_BY_LOCAL_MODEL = re.compile(
    r"gguf|lora|awq|gptq|mlx|onnx|(?:^|[-_./])ct2(?:[-_.]|$)", re.IGNORECASE)

#: How many declared models are offered to try, in the card's own order.
DECLARED_CANDIDATE_LIMIT = 3


def declared_model_candidates(code: str, *, get_card=None,
                              limit: int = DECLARED_CANDIDATE_LIMIT) -> dict:
    """Open models whose OWN model card declares the target, loadable by the
    local-model engine — twin of ``declaredModelCandidates`` in
    cli/lib/recommend.js, so ``mt-eval recommend`` (a pip install's door)
    names the same candidates as ``champollion network recommend`` and the
    MCP language_overview (Round 11).

    Read through the card adapter (language_cards.get_card normalizes the card:
    ``methodSupportEvidence`` holds the atlas's named methodSupport claims).
    A claim is the model publisher's statement, never a measurement.
    """
    none = {"declared_total": 0, "listed": 0, "loadable": 0, "candidates": [],
            "not_loadable": []}
    if get_card is None:
        from mt_eval_harness.language_cards import get_card as get_card
    try:
        card = get_card(code)
    except Exception as exc:  # noqa: BLE001 — said, never a silent empty list
        return {**none, "problem": f"the language card for '{code}' could not "
                                   f"be read ({type(exc).__name__}: {exc})"}
    if not card:
        return {**none, "problem": f"no language card for '{code}'"}
    ev = card.get("methodSupportEvidence")
    ev = ev if isinstance(ev, dict) else None
    claims = [n for n in ((ev or {}).get("named") or [])
              if isinstance(n, dict) and n.get("value") != "service"
              and isinstance(n.get("variant"), str) and n.get("variant")]
    if not claims:
        return {**none, "problem": f"the language card for '{code}' records "
                                   f"no model that declares it"}
    hf = [n for n in claims if n["variant"].startswith("hf:")]
    loadable = [n for n in hf if not NOT_LOADABLE_BY_LOCAL_MODEL.search(n["variant"])]
    total = ev.get("total")
    return {
        "declared_total": total if isinstance(total, int) and not isinstance(total, bool)
        else len(claims),
        "listed": len(claims),
        "loadable": len(loadable),
        "candidates": [{"id": n["variant"][len("hf:"):],
                        "claim": n.get("confidence") or n.get("value"),
                        "source": n.get("source")}
                       for n in loadable[:limit]],
        "not_loadable": [n["variant"][len("hf:"):] for n in hf
                         if NOT_LOADABLE_BY_LOCAL_MODEL.search(n["variant"])],
        "problem": None,
    }


def declared_models_section(tgt: str, methods: list[dict], curated_rows: list[dict],
                            bulk_rows: list[dict], declared: dict | None = None) -> dict:
    """The candidates joined to the registry's local-model engine (its
    availability and lane) and to the pair's published evidence — twin of
    ``declaredModelsSection`` in cli/lib/recommend.js."""
    found = declared if declared is not None else declared_model_candidates(tgt)
    engine = next((m for m in methods if m.get("kind") == "local-model"), None)
    evidenced = {str(v).lower() for r in [*curated_rows, *bulk_rows]
                 for v in (r.get("model"), r.get("method_ref")) if v}
    return {
        **found,
        "engine": ({"method": engine["method"],
                    "availability": engine.get("availability"),
                    "availability_detail": engine.get("availability_detail"),
                    "lane_ok": engine.get("lane_ok"),
                    "lane_note": engine.get("lane_note")} if engine else None),
        "candidates": [{
            **c,
            "method": engine["method"] if engine else None,
            "runnable": bool(engine) and bool(engine.get("lane_ok")),
            "published_evidence": c["id"].lower() in evidenced,
            **({"run": f"mt-eval run --method {engine['method']} --model {c['id']} "
                       f"--corpus <your test file>"} if engine else {}),
        } for c in found["candidates"]],
    }


def _declared_models_lines(payload: dict) -> list[str]:
    """Twin of renderDeclaredModels in cli/lib/recommend.js."""
    d = payload.get("declared_models")
    if not d:
        return []
    tgt = payload["pair"]["target"]
    out = [""]
    if d.get("problem"):
        out.append(f"Open models whose model card declares {tgt}: none to "
                   f"suggest ({d['problem']}).")
        return out
    named = (f", {d['listed']} named on the card"
             if d["listed"] < d["declared_total"] else "")
    out.append(f"Open models whose model card declares {tgt} "
               f"({d['declared_total']} declared{named} — the publisher's "
               f"claim, not a measurement):")
    e = d.get("engine")
    method = e["method"] if e else "local-model"
    if not d["candidates"]:
        out.append(f"  none in a format {method} loads (a transformers "
                   f"checkpoint on Hugging Face, or a CTranslate2 directory).")
    elif not e:
        out.append("  DECLARED — no method in this registry loads them:")
    elif not e.get("lane_ok"):
        out.append(f"  EXCLUDED — {e['method']}: {e.get('lane_note')}:")
    else:
        kinds = []
        for c in d["candidates"]:
            k = ("RUNNABLE, PUBLISHED EVIDENCE ABOVE" if c["published_evidence"]
                 else "RUNNABLE, NO PUBLISHED EVIDENCE")
            if k not in kinds:
                kinds.append(k)
        out.append(f"  {' / '.join(kinds)} — via {e['method']} "
                   f"({e.get('availability_detail')}), in the card's order, "
                   f"not a ranking:")
    for c in d["candidates"]:
        tag = ("  (published evidence above)"
               if e and e.get("lane_ok") and c["published_evidence"] else "")
        out.append(f"    {c['id']}   [{c.get('claim') or 'claim'}; "
                   f"{c.get('source') or 'source not recorded'}]{tag}")
    more = d.get("loadable", len(d["candidates"])) - len(d["candidates"])
    if more > 0:
        out.append(f"    (+{more} more on the card in a format {method} loads — "
                   f"`champollion network card {tgt} --json` lists every claim "
                   f"it names, under methodSupportEvidence)")
    if d["candidates"] and e and e.get("lane_ok"):
        out.append(f"    try one: {d['candidates'][0]['run']}")
        out.append(f"    ({e['method']} runs seq2seq translation checkpoints — "
                   f"check the model card first)")
    if d["not_loadable"]:
        shown = ", ".join(d["not_loadable"][:3])
        rest = (f", … ({len(d['not_loadable'])} in all)"
                if len(d["not_loadable"]) > 3 else "")
        out.append(f"  not loadable by {method} by id (an adapter, a quantized "
                   f"or ONNX export, or a CTranslate2 conversion): {shown}{rest}")
    return out


# ---------------------------------------------------------------------------
# Tier 2 — curated cited results (direction-exact)
# ---------------------------------------------------------------------------

def curated_evidence(
    src: str, tgt: str,
    catalogue: dict | None = None,
) -> tuple[list[dict], dict[str, dict]]:
    """Direction-exact curated datapoints + the cited-methods index.

    Returns (rows, methods_index). Rows carry per-datapoint provenance;
    ranking across different (benchmark, metric) buckets is deliberately NOT
    performed — metric variants are incomparable (metric_variant_flag).
    """
    if catalogue is None:
        catalogue = _load_json(catalogue_path("external-results.json"))
    if not catalogue:
        return [], {}
    methods_index = {m.get("id"): m for m in catalogue.get("methods") or []}
    rows = []
    for r in catalogue.get("results") or []:
        pair = r.get("pair") or {}
        if pair.get("source") != src or pair.get("target") != tgt:
            continue
        grade = normalize_grade((r.get("signal_strength") or {}).get("contamination"))
        rows.append({
            "tier": "curated",
            "model": r.get("model"),
            "benchmark": r.get("benchmark"),
            "metric": r.get("metric"),
            "value": r.get("value"),
            "lower_is_better": bool(r.get("lower_is_better")),
            "grade": (r.get("signal_strength") or {}).get("grade"),
            "lane": lane_for_grade(grade) if grade else LANE_RELATIVE_ONLY,
            "verified": bool(r.get("verified")),
            "citation": r.get("citation"),
            "source_url": r.get("source_url"),
            "method_ref": r.get("method_ref"),
        })
    return rows, methods_index


# ---------------------------------------------------------------------------
# Tier 3 — bulk cited index (relative-only by construction)
# ---------------------------------------------------------------------------

def _base_code(code: str) -> str:
    """Strip a FLORES-style script suffix: 'ace_Arab' → 'ace'."""
    return code.split("_", 1)[0]


def bulk_evidence(
    src: str, tgt: str,
    index: dict | None = None,
    max_rows: int = 8,
) -> tuple[list[dict], dict[str, Any]]:
    """Best-published rows for the pair from the bulk index.

    Pair keys are upstream codes (may carry script suffixes); we match on the
    script-stripped base and surface the exact upstream key on each row so
    nothing is silently relabelled. Returns (rows, meta).
    """
    if index is None:
        index = _load_json(catalogue_path("external-mt-index.json"))
    if not index:
        return [], {}
    models = index.get("models") or []
    posture = index.get("contamination_posture") or {}
    rows = []
    for key, cells in (index.get("pairs") or {}).items():
        s, _, t = key.partition("-")
        if _base_code(s) != src or _base_code(t) != tgt:
            continue
        for testset, metrics in cells.items():
            for metric, (model_idx, value) in metrics.items():
                model = (models[model_idx]
                         if isinstance(model_idx, int) and model_idx < len(models)
                         else str(model_idx))
                rows.append({
                    "tier": "bulk",
                    "pair_key": key,
                    "model": model,
                    "benchmark": testset,
                    "metric": metric,
                    "value": value,
                    "lane": LANE_RELATIVE_ONLY,
                    "posture": posture.get(testset),
                })
    rows.sort(key=lambda r: (r["benchmark"], r["metric"], r["pair_key"]))
    meta = {
        "provider": index.get("provider"),
        "provenance": index.get("provenance"),
        "truncated": len(rows) > max_rows,
        "total_rows": len(rows),
    }
    return rows[:max_rows], meta


# ---------------------------------------------------------------------------
# Tier 4 — metric-reliability evidence (which metric to BELIEVE for the target)
# ---------------------------------------------------------------------------

def card_family_claims(code: str) -> tuple[list[dict], str | None]:
    """Every cited claim the target's language card makes about its family.

    Read through the card adapter (language_cards.get_card → attributions()),
    never a bare card read: ``classification.family`` is an attribution
    envelope wherever Glottolog and WALS disagree, and a disagreement stays a
    disagreement here — nothing is elected. Returns ``([{value, source}],
    problem)``: ``problem`` is a plain reason when no claim could be read
    (no card, no family recorded, card index unreachable), else None.
    """
    from mt_eval_harness import language_cards
    from mt_eval_harness.language_cards_remote import LanguageCardsUnavailable
    try:
        card = language_cards.get_card(code)
    except LanguageCardsUnavailable as exc:
        return [], f"language card unavailable: {exc}"
    if not card:
        return [], f"no language card for '{code}'"
    cls = card.get("classification") if isinstance(card.get("classification"), dict) else {}
    fam = cls.get("family")
    if language_cards.is_attributed(fam):
        claims = language_cards.attributions(fam)
    elif isinstance(cls.get("familyAttributions"), list) and cls["familyAttributions"]:
        # The published projection: a flat family plus its attribution list.
        claims = [c for c in cls["familyAttributions"] if isinstance(c, dict)]
    elif fam:
        stamped = (card.get("_fieldSources") or {}).get("classification.family")
        source = (", ".join(s for s in stamped if isinstance(s, str))
                  if isinstance(stamped, list) else stamped)
        claims = [{"value": fam, "source": source or None}]
    else:
        claims = []
    claims = [{"value": c.get("value"), "source": c.get("source")} for c in claims
              if isinstance(c.get("value"), str) and c.get("value")]
    if not claims:
        return [], f"the language card for '{code}' records no family"
    return claims, None


def _claims_text(claims: list[dict]) -> str:
    """'Uralic (glottolog-v5.3, wals-v2020.5)' — every claim, grouped by value."""
    by_value: dict[str, list[str]] = {}
    for c in claims:
        by_value.setdefault(c["value"], []).append(c.get("source") or "source not recorded")
    return "; ".join(f"{v} ({', '.join(srcs)})" for v, srcs in by_value.items())


def metric_reliability_evidence(
    tgt: str,
    reliability: dict | None = None,
    family_claims=None,
) -> tuple[dict | None, list[str]]:
    """Per-target-family metric↔human correlation evidence (workstream B3).

    Answers a different question from tiers 1–3: not "which SYSTEM scores
    best" but "which METRIC can you trust to score output in this target
    language". Sourced from shared/catalogue/metric-reliability.json — the
    champollion-derived correlations between automatic metrics and the WMT
    Metrics-task human judgments (wmt19–wmt25); methodology spec:
    https://champollion.dev/docs/network/specifications/metric-reliability

    A target WMT never judged is looked up by FAMILY: its language card's
    family claims (``family_claims``, default card_family_claims — a callable
    ``code -> ([{value, source}], problem)``, injectable for tests) are
    matched exactly against the index's family roll-ups. Exactly one
    evidenced family → that roll-up, with the claims that put the target
    there and the transfer caveat. Sources naming two different evidenced
    families → no pick, UNMEASURED. (This lookup used to stop at the judged
    languages while its note claimed "directly or via its family", so a
    Uralic language like Northern Sami was told no family evidence covered
    it beside a list naming Uralic as evidenced.)

    Returns (section | None, notes). Fail-honest: an absent index, or a
    target language no WMT campaign ever judged, yields an explicit note —
    never a silent skip and never borrowed numbers.
    """
    if reliability is None:
        reliability = _load_json(catalogue_path("metric-reliability.json"))
        if reliability is None:
            return None, [
                "Metric-reliability index not available in this install — "
                "metric-trust tier skipped explicitly."
            ]
    languages = reliability.get("languages") or {}
    families = reliability.get("families") or {}
    code = info = None
    for key, entry in sorted(languages.items()):
        if tgt == key or tgt == (entry or {}).get("iso639_3"):
            code, info = key, entry
            break
    notes: list[str] = []
    family_basis = None
    if info is None:
        claims, problem = (family_claims or card_family_claims)(tgt)
        evidenced = sorted({c["value"] for c in claims if c["value"] in families})
        unmeasured_tail = (
            " — metric choice for this language is UNMEASURED. Treat every "
            "metric as unvalidated there; prefer metrics with "
            "morphology-robust behaviour and validate locally where possible."
        )
        if problem:
            return None, [
                f"No WMT human-judgment meta-evaluation covers target '{tgt}' "
                f"directly, and its family could not be checked ({problem})"
                + unmeasured_tail
            ]
        if not evidenced:
            return None, [
                f"No WMT human-judgment meta-evaluation covers target '{tgt}' "
                f"directly or via its family (per its language card: "
                f"{_claims_text(claims)} — no WMT-judged target language in "
                f"that family)" + unmeasured_tail
            ]
        if len(evidenced) > 1:
            return None, [
                f"No WMT human-judgment meta-evaluation covers target '{tgt}' "
                f"directly, and its language card's family sources disagree "
                f"between families that each have evidence "
                f"({_claims_text(claims)}) — Champollion does not pick between "
                f"sources" + unmeasured_tail
            ]
        family = evidenced[0]
        family_basis = {
            "via": "language-card",
            "claims": claims,
            "matched_sources": [c.get("source") for c in claims if c["value"] == family],
        }
        notes.append(
            f"'{tgt}' was never a WMT-judged target; its language card "
            f"classifies it as {_claims_text([c for c in claims if c['value'] == family])}, "
            f"so the {family} family roll-up is the closest evidence."
        )
        others = [c for c in claims if c["value"] != family]
        if others:
            notes.append(
                f"The card's family sources disagree ({_claims_text(claims)}); "
                f"only '{family}' names a family this index rolls up, so the "
                f"evidence shown rests on that classification alone."
            )
    else:
        family = info.get("family") or "Unclassified"
    fam_block = families.get(family) or {}
    metrics_out = []
    for metric_id, levels in sorted((fam_block.get("metrics") or {}).items()):
        sys_e = levels.get("sys") or {}
        seg_e = levels.get("seg") or {}
        metrics_out.append({
            "metric": metric_id,
            "sys_pearson": sys_e.get("pearson_weighted_mean"),
            "sys_pairwise_accuracy": sys_e.get("pairwise_accuracy_weighted_mean"),
            "sys_n_pairs": sys_e.get("n_pairs"),
            "seg_kendall": seg_e.get("kendall_tau_b_weighted_mean"),
            "seg_n_pairs": seg_e.get("n_pairs"),
        })
    metrics_out.sort(
        key=lambda m: -2.0 if m["sys_pearson"] is None else -m["sys_pearson"])
    exact_pairs = sorted({
        c["pair"] for c in reliability.get("cells") or []
        if code is not None and c.get("tgt") == code and c.get("preferred")
    })
    if not exact_pairs:
        notes.append(
            f"Family-level metric evidence only: the '{family}' correlations "
            f"come from other {family} target languages, never from '{tgt}' "
            f"itself — transfer within a family is an assumption, not a "
            f"measurement."
        )
    lane = reliability.get("license_lane") or {}
    if lane.get("commercial_ok") is False:
        notes.append(
            "Metric-reliability evidence rides a non-commercial hold: the "
            "upstream WMT human-judgment data states no license, and its use "
            "beyond research has not yet been reviewed — cite it in research "
            "lanes only."
        )
    section = {
        "target_code": code,
        "target_iso639_3": (info or {}).get("iso639_3"),
        "target_family": family,
        "exact_pairs_measured": exact_pairs,
        "family_metrics": metrics_out,
        "provenance": reliability.get("provenance"),
    }
    if family_basis is not None:
        section["family_basis"] = family_basis
    return section, notes


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------

def recommend(
    src: str, tgt: str, *,
    use_context: str = "non-commercial",
    manifest: dict | None = None,
    curated: dict | None = None,
    bulk: dict | None = None,
    reliability: dict | None = None,
    env: dict[str, str] | None = None,
    coverage: dict | None = None,
    card_support=None,
    declared: dict | None = None,
) -> dict:
    """Assemble the full recommendation payload for one directed pair.
    ``declared``: a declared_model_candidates() answer (tests); by default
    read from the target's card."""
    card_errors: list[str] = []
    if card_support is None:
        card_support = lambda code, method: card_method_support(  # noqa: E731
            code, method, card_errors)
    methods = dispatchable_methods(use_context, manifest=manifest, env=env,
                                   tgt=tgt, coverage=coverage, src=src,
                                   card_support=card_support)
    curated_rows, cited_methods = curated_evidence(src, tgt, catalogue=curated)
    bulk_rows, bulk_meta = bulk_evidence(src, tgt, index=bulk)
    reliability_section, reliability_notes = metric_reliability_evidence(
        tgt, reliability=reliability)
    declared_models = declared_models_section(tgt, methods, curated_rows,
                                              bulk_rows, declared)

    # Join: which cited models are dispatchable / commercially deployable?
    evidenced_models = []
    seen = set()
    for row in curated_rows:
        ref = row.get("method_ref")
        if not ref or ref in seen:
            continue
        seen.add(ref)
        m = cited_methods.get(ref) or {}
        evidenced_models.append({
            "id": ref,
            "name": m.get("name"),
            "runnable_in_champollion": bool(m.get("runnable_in_champollion")),
            "commercial_use": m.get("commercial_use"),
            "license": m.get("license"),
        })

    notes = [
        "Cited evidence orders methods RELATIVE to each other on memorized "
        "public benchmarks — it is never absolute quality and never a "
        "deployment ranking (relative-comparison-only lane).",
        "Evidence and runnability are different axes: the best-evidenced "
        "model may not be dispatchable here, and NC-licensed weights are "
        "excluded from commercial-lane recommendations.",
    ]
    if curated is None and catalogue_path("external-results.json") is None:
        notes.append("Curated cited-results index not available in this "
                     "install — tier skipped explicitly.")
    if bulk is None and catalogue_path("external-mt-index.json") is None:
        notes.append("Bulk published-results index not available in this "
                     "install — tier skipped explicitly.")
    if not curated_rows and not bulk_rows:
        notes.append(
            f"NO published evidence indexed for {src}→{tgt}. That is the "
            f"honest answer — measure instead of guessing: "
            f"`mt-eval corpora --source {src} --target {tgt}` lists runnable "
            f"benchmarks, `mt-eval run` produces your own scored evidence."
        )
    if card_errors:
        notes.append(f"Language-card coverage unavailable ({card_errors[0]}) — method "
                     f"coverage read from method-coverage.json only.")
    notes.extend(reliability_notes)

    return {
        "pair": {"source": src, "target": tgt},
        "use_context": use_context,
        "runnable_methods": methods,
        # Open models whose model card declares the target, loadable by the
        # local-model engine: what to try when nothing is measured. A claim,
        # never evidence (declared_model_candidates).
        "declared_models": declared_models,
        "curated_evidence": curated_rows,
        "bulk_evidence": bulk_rows,
        "bulk_meta": bulk_meta,
        "evidenced_models": evidenced_models,
        "metric_reliability": reliability_section,
        "notes": notes,
    }


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

def render_text(payload: dict) -> str:
    """Human-readable rendering of a recommend() payload."""
    p = payload["pair"]
    out = [f"Method guidance — {p['source']} → {p['target']}   "
           f"(lane: {payload['use_context']})", ""]

    out.append("Runnable methods (shared/method-registry.json):")
    if not payload["runnable_methods"]:
        out.append("  (method registry not available in this install)")
    mark = {"not-listed": "✗", "unknown": "?", "disputed": "?"}
    for m in payload["runnable_methods"]:
        badge = {"ready": "READY       ", "unverified": "UNVERIFIED  ",
                 "needs-key": "NEEDS KEY   ",
                 "local-setup": "LOCAL       ",
                 "unsupported": "UNSUPPORTED "}.get(m["availability"], "?           ")
        line = f"  {badge}{m['method']:<22}{m['availability_detail']}"
        if m["license"]:
            line += f"   [{m['license']}]"
        if not m["lane_ok"]:
            line = f"  EXCLUDED    {m['method']:<22}{m['lane_note']}"
        out.append(line)
        # An UNSUPPORTED row already states why; the source side is shown only
        # when it adds something (twin of cli/lib/recommend.js renderText).
        if m.get("lane_ok") and m["availability"] != "unsupported":
            if m.get("target_coverage_note"):
                out.append(f"{'':14}{mark.get(m['target_coverage'], '↳')} "
                           f"{m['target_coverage_note']}")
            sc = m.get("source_coverage")
            if m.get("source_coverage_note") and (
                    sc == "disputed" or (sc == "unknown" and m.get("target_coverage") != "unknown")):
                out.append(f"{'':14}{mark[sc]} source {p['source']}: {m['source_coverage_note']}")

    out.extend(_declared_models_lines(payload))

    out.append("")
    out.append("Published evidence for this pair (cited — never reproduced "
               "by us; relative ordering only):")
    if not payload["curated_evidence"] and not payload["bulk_evidence"]:
        out.append("  none indexed.")
    for r in payload["curated_evidence"]:
        v = "verified" if r["verified"] else "UNVERIFIED"
        out.append(f"  [curated/{v}] {r['benchmark']} {r['metric']}="
                   f"{r['value']} — {r['model']}  (grade {r.get('grade')}; "
                   f"{r['citation']})")
    for r in payload["bulk_evidence"]:
        out.append(f"  [bulk] {r['benchmark']} {r['metric']}={r['value']} — "
                   f"{r['model']}  (pair key {r['pair_key']})")
    if payload["bulk_meta"].get("truncated"):
        out.append(f"  … {payload['bulk_meta']['total_rows']} bulk rows total "
                   f"(showing best-per-bucket head).")

    if payload["evidenced_models"]:
        out.append("")
        out.append("Evidenced models vs. dispatchability:")
        for m in payload["evidenced_models"]:
            bits = []
            bits.append("runnable in Champollion" if m["runnable_in_champollion"]
                        else "NOT dispatchable here yet")
            if m.get("commercial_use") is False:
                bits.append("weights NC — non-commercial only")
            out.append(f"  {m.get('name') or m['id']}: {'; '.join(bits)}")

    rel = payload.get("metric_reliability")
    if rel:
        out.append("")
        out.append(
            f"Metric trust for the target (family: {rel['target_family']} — "
            f"WMT human-judgment correlations; which metric to believe):")
        for m in rel["family_metrics"]:
            sp = "—" if m["sys_pearson"] is None else f"{m['sys_pearson']:+.2f}"
            sk = "—" if m["seg_kendall"] is None else f"{m['seg_kendall']:+.2f}"
            n = m["sys_n_pairs"] or m["seg_n_pairs"] or 0
            out.append(f"  {m['metric']:<18} sys-Pearson {sp:>5}   "
                       f"seg-Kendall {sk:>5}   ({n} pair(s))")
        measured = (", ".join(rel["exact_pairs_measured"])
                    if rel["exact_pairs_measured"] else "none — family-level only")
        out.append(f"  directly measured pairs for this target: {measured}")
        basis = rel.get("family_basis")
        if basis:
            out.append(f"  family per the target's language card: "
                       f"{_claims_text(basis['claims'])}")

    out.append("")
    for n in payload["notes"]:
        out.append(f"⚠ {n}")
    return "\n".join(out)
