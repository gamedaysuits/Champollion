"""LLM-as-judge quality signal for the docent eval — OUTSIDE any composite.

Three independent lenses per case; 2-of-3 must pass. The judge is a pluggable
callable ``judge_fn(prompt: str) -> str`` so it is mockable in tests and can be
any model in the real run. Judges are TOLD to read code-switching (e.g. Taglish)
as CORRECT register, never as an error — so a fluent Taglish answer is scored as
good, not as contamination.

This is advisory + separately gated (never folded into a deterministic pass/fail
a machine computed from a machine's opinion — the scoring.py doctrine).
"""

from __future__ import annotations

import re
from typing import Any, Callable

JudgeFn = Callable[[str], str]

_LENSES = {
    "fluency_register": (
        "Judge ONLY fluency and register. Does the answer read like a fluent, "
        "warm, natural {locale} speaker? Natural code-switching (e.g. Taglish "
        "for Filipino) is CORRECT and must NOT be penalized. Answer YES if the "
        "language and tone are natural and appropriate, NO otherwise."
    ),
    "groundedness": (
        "Judge ONLY groundedness. Does the answer stay within what the retrieved "
        "docs support, without inventing facts, numbers, names, or capabilities? "
        "Saying 'I don't have a cited source' is GROUNDED (answer YES). Answer NO "
        "only if it fabricates or overclaims."
    ),
    "tone": (
        "Judge ONLY helpfulness + tone. Is the answer encouraging, professional, "
        "and instructive (points to a next step / page), not cold or condescending? "
        "YES or NO."
    ),
}


def _prompt(lens_instruction: str, case: dict[str, Any], answer: str, locale: str) -> str:
    return (
        f"You are grading a site-guide chatbot's answer. {lens_instruction.format(locale=locale)}\n\n"
        f"VISITOR ASKED ({locale}): {case.get('question','')}\n\n"
        f"THE ANSWER:\n{answer}\n\n"
        "Reply with exactly YES or NO on the first line, then one short reason."
    )


def _verdict_yes(text: str) -> bool:
    m = re.search(r"\b(yes|no)\b", (text or "").strip().lower())
    return bool(m) and m.group(1) == "yes"


def judge_quality(
    case: dict[str, Any],
    answer: str,
    judge_fn: JudgeFn,
    locale: str = "en",
) -> dict[str, Any]:
    verdicts = {}
    for lens, instruction in _LENSES.items():
        try:
            resp = judge_fn(_prompt(instruction, case, answer, locale))
            verdicts[lens] = _verdict_yes(resp)
        except Exception as exc:  # a judge failure is a NO, never a crash
            verdicts[lens] = False
            verdicts[f"{lens}_error"] = str(exc)[:120]
    passes = sum(1 for k, v in verdicts.items() if k in _LENSES and v)
    return {
        "quality_pass": passes >= 2,
        "lens_passes": passes,
        "verdicts": verdicts,
    }
