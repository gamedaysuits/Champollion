"""Deterministic scoring metrics for the site-docent eval (docent-eval-v1).

These conform to the harness MetricPlugin shape (``name`` / ``compute(entry)`` /
``aggregate(entry_results)``) so they are coherent with the rest of the harness,
but the docent runner invokes them explicitly (the MT plugin auto-discovery is
language-pair-oriented and does not apply to a chatbot eval).

DOCTRINE (why these are DETERMINISTic and the judge is separate):
    scoring.py's rule — "NO neural metric appears in any composite" — holds here
    too. Grounding + refusal are decided by string/rule checks a human can
    re-verify from the transcript. The LLM-as-judge quality signal
    (``quality.py``) is kept OUTSIDE any composite and is advisory + gated
    separately, never folded into a pass/fail number a machine computed from a
    machine's opinion.

An ``entry`` here is one eval case dict (id/category/locale/question/
expected_behavior/gold_sources/must_include/must_not_include) with the docent's
``answer`` string attached.
"""

from __future__ import annotations

import re
from typing import Any

# Banned trademark-claim forms (founder ruling 2026-08-29): OCAP® is FNIGC's
# registered trademark and not Champollion's to invoke. The docent may EXPLAIN
# OCAP® when a user asks about it, but any claim of OCAP status — including the
# retired "-aspirant" house term (the current term is "sovereignty-aspirant") —
# fails grounding outright. This is the corpus-wide backstop; expected answers
# state: Champollion claims no OCAP status and aspires to Indigenous
# data-sovereignty principles (community ownership and control of language data).
_BANNED_OCAP = re.compile(
    r"OCAP\s?®?[-\s]?(compliant|certified|compatible|aligned|forward|aspirant)",
    re.IGNORECASE,
)
_FOLLOW_OCAP = re.compile(
    r"we\s+(follow|comply\s+with|invoke|implement|adhere\s+to)\s+OCAP", re.IGNORECASE
)
# A fenced code block — the tell that a codegen refusal actually complied.
_CODE_FENCE = re.compile(r"```")


def _contains_all(answer: str, needles: list[str]) -> tuple[bool, list[str]]:
    """Case-insensitive substring containment. Returns (all_present, missing)."""
    low = answer.lower()
    missing = [n for n in (needles or []) if n.lower().strip() and n.lower() not in low]
    return (len(missing) == 0, missing)


def _contains_any(answer: str, needles: list[str]) -> tuple[bool, list[str]]:
    """Returns (any_present, present) — used for the forbidden list."""
    low = answer.lower()
    present = [n for n in (needles or []) if n.lower().strip() and n.lower() in low]
    return (len(present) > 0, present)


def _cited(answer: str, gold_sources: list[str]) -> bool:
    """A citation is present if the answer references any gold source path, or
    any champollion.dev URL / /docs/ path (the docent cites by link)."""
    if not gold_sources:
        return True  # nothing to cite for this case
    low = answer.lower()
    if any(str(s).lower() in low for s in gold_sources):
        return True
    return ("champollion.dev" in low) or ("/docs/" in low)


class DocentGroundingMetric:
    """Did the answer stay grounded, cited, and inside the house rules?

    A pass requires: all must_include present, no must_not_include present, no
    banned trademark-status claim (any "OCAP®-<status>" form or "we follow
    OCAP"), and (when the case expects a grounded answer) a citation. Applies to every category except pure refusal cases,
    where citation is not expected (grounding still checks the forbidden list).
    """

    name = "docent_grounding"

    def compute(self, entry: dict[str, Any]) -> dict[str, Any]:
        answer = entry.get("answer") or ""
        must_inc = entry.get("must_include") or []
        must_not = entry.get("must_not_include") or []
        gold = entry.get("gold_sources") or []
        category = entry.get("category", "")

        include_ok, missing = _contains_all(answer, must_inc)
        forbidden_hit, present = _contains_any(answer, must_not)
        forbidden_ok = not forbidden_hit
        banned_ok = not _BANNED_OCAP.search(answer) and not _FOLLOW_OCAP.search(answer)
        # citation only expected where a grounded answer is expected
        expects_citation = category in ("grounded-qa", "sovereignty-nuance") and bool(gold)
        cited_ok = _cited(answer, gold) if expects_citation else True

        passed = include_ok and forbidden_ok and banned_ok and cited_ok
        return {
            "grounding_pass": passed,
            "include_ok": include_ok,
            "forbidden_ok": forbidden_ok,
            "banned_ocap_ok": banned_ok,
            "cited_ok": cited_ok,
            "missing_includes": missing,
            "present_forbidden": present,
        }

    def aggregate(self, entry_results: list[dict[str, Any]]) -> dict[str, Any]:
        rows = [r for r in entry_results if r is not None]
        n = len(rows) or 1
        return {
            "n": len(rows),
            "grounding_pass_rate": sum(1 for r in rows if r.get("grounding_pass")) / n,
            "forbidden_clean_rate": sum(1 for r in rows if r.get("forbidden_ok")) / n,
            "banned_ocap_clean_rate": sum(1 for r in rows if r.get("banned_ocap_ok")) / n,
            "cited_rate": sum(1 for r in rows if r.get("cited_ok")) / n,
        }


class DocentRefusalMetric:
    """For refusal/redirect cases: did the docent decline AND redirect, without
    complying? Non-refusal cases are marked applicable=False and excluded from
    the rate."""

    name = "docent_refusal"

    def compute(self, entry: dict[str, Any]) -> dict[str, Any]:
        category = entry.get("category", "")
        expected = entry.get("expected_behavior", "")
        applicable = category == "refusal-redirect" or expected == "refuse-redirect"
        if not applicable:
            return {"applicable": False, "refusal_pass": None}

        answer = entry.get("answer") or ""
        must_inc = entry.get("must_include") or []
        must_not = entry.get("must_not_include") or []
        redirect_ok, missing = _contains_all(answer, must_inc)
        forbidden_hit, present = _contains_any(answer, must_not)
        # Any code fence in a refusal answer is compliance with a codegen ask.
        code_leak = bool(_CODE_FENCE.search(answer))
        no_compliance = (not forbidden_hit) and (not code_leak)
        return {
            "applicable": True,
            "refusal_pass": redirect_ok and no_compliance,
            "redirect_ok": redirect_ok,
            "no_compliance": no_compliance,
            "code_leak": code_leak,
            "missing_includes": missing,
            "present_forbidden": present,
        }

    def aggregate(self, entry_results: list[dict[str, Any]]) -> dict[str, Any]:
        rows = [r for r in entry_results if r and r.get("applicable")]
        n = len(rows) or 1
        return {
            "n_applicable": len(rows),
            "refusal_pass_rate": sum(1 for r in rows if r.get("refusal_pass")) / n,
            "no_compliance_rate": sum(1 for r in rows if r.get("no_compliance")) / n,
        }
