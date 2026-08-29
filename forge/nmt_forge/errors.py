"""Forge error taxonomy — every refusal is actionable.

The suite's contract (from the 2026-07-12 crk-translate mistake ledger, the
requirements document for this package): bad practice is corrected or refused
with a message that says WHAT happened, WHY it matters, and the exact FIX —
never a bare warning the user scrolls past. Every guard raises a
:class:`GuardrailViolation` subclass carrying those three fields; the
formatted message renders all of them.
"""

from __future__ import annotations


class ForgeError(Exception):
    """Base class for every error forge raises deliberately."""


class GuardrailViolation(ForgeError):
    """A guard refused an operation.

    Attributes:
        guard: short name of the guard that fired (e.g. ``split-guard``).
        why:   one line on why the refused thing corrupts results.
        fix:   the exact command / API call that does it right.
    """

    guard: str = "guardrail"

    def __init__(self, message: str, *, why: str = "", fix: str = ""):
        self.why = why
        self.fix = fix
        parts = [f"[{self.guard}] {message}"]
        if why:
            parts.append(f"  why: {why}")
        if fix:
            parts.append(f"  fix: {fix}")
        super().__init__("\n".join(parts))


class SplitLeakageError(GuardrailViolation):
    guard = "split-guard"


class DevFenceError(GuardrailViolation):
    guard = "dev-fence"


class LeakageError(GuardrailViolation):
    guard = "leak-audit"


class FunnelRegression(GuardrailViolation):
    guard = "funnel-audit"


class ConventionError(GuardrailViolation):
    guard = "convention-lint"


class CoverageError(GuardrailViolation):
    guard = "coverage-map"


class StrataError(GuardrailViolation):
    guard = "sample-strata"


class ScoringError(GuardrailViolation):
    guard = "ci-scoring"


class PreregistrationMissing(GuardrailViolation):
    guard = "preregister"


class PreregistrationInvalid(GuardrailViolation):
    guard = "preregister"


class SealedSetSpent(GuardrailViolation):
    guard = "eval-ledger"


class GenerationHeadroomError(GuardrailViolation):
    guard = "decode"


class RegistryError(ForgeError):
    """Eval-registry bookkeeping failure (bad role, sha drift, name clash)."""


class LedgerError(ForgeError):
    """Ledger corruption or hash-chain break."""


class CitationError(ForgeError):
    """A template, rule, or checklist item was declared without a citation.

    Grammar-cited generation is a hard requirement: every template kind must
    say which published grammar it transcribes (work-level citation, no
    invented page numbers).
    """


class SynthesisError(GuardrailViolation):
    guard = "synthesis-engine"


class ResourceMissing(ForgeError):
    """A language-pack resource (FST, dictionary) is not available locally.

    Raised with fetch instructions. Forge never fetches restricted resources
    itself: AGPL FST model files and use-restricted dictionaries are fetched
    by the user under the upstream's terms and pointed at via env/config.
    """

    def __init__(self, message: str, *, how_to_get: str = ""):
        self.how_to_get = how_to_get
        full = message if not how_to_get else f"{message}\n  how to get it: {how_to_get}"
        super().__init__(full)


class BackendError(ForgeError):
    """Trainer-backend failure or missing optional dependency."""


class ConfigError(ForgeError):
    """Invalid run configuration."""
