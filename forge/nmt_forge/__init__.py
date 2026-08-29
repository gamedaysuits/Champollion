"""nmt-forge — an NMT training suite that makes the catalogued mistakes hard.

Requirements document: the 2026-07-12 crk-translate mistake ledger (11
entries, each mistake → concrete example → guard). Design spec: forge/DESIGN.md.

The suite refuses bad practice with actionable messages (what / why / fix),
synthesizes training data only through round-trip-verified, grammar-cited
templates, and delegates ALL scoring to mt-eval.
"""

__version__ = "0.1.0"

from .canonical import canonical_key, config_hash, stable_hash  # noqa: F401
from .errors import ForgeError, GuardrailViolation, ResourceMissing  # noqa: F401
from .workspace import Workspace  # noqa: F401
