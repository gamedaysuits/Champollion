"""
IP / data-sovereignty consent gate for the Plains Cree (nêhiyawêwin) LYSS standard.

The Cree gloss data this standard relies on is fetched live from the itwêwina API
and built on dictionary content that is NOT openly licensed; the Cree validation
standard itself is treated as the property of the nêhiyaw language community
(non-commercial, community-governed). Before any restricted Cree data is touched at
runtime, the user is shown an unmissable notice and must acknowledge it. The goal
is to respect IP and have users respect IP — without breaking unattended runs.

Acknowledgment resolves in this order:
  1. A remembered acknowledgment marker (~/.mt-eval/.crk-ip-acknowledged).
  2. The explicit env var CHAMPOLLION_LYSS_ACCEPT_IP (truthy).
  3. Non-interactive / CI auto-consent (CI, MT_EVAL_AUTO_SETUP, or non-tty stdin)
     — matching the harness's FST-download auto-consent. The notice still prints.
  4. An interactive [y/N] prompt.

If NOT acknowledged, the caller (the semantic validator's gloss source) disables
gloss lookups, and gloss-dependent scores are reported as unavailable — never
fabricated.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

ACCEPT_ENV = "CHAMPOLLION_LYSS_ACCEPT_IP"
_ACK_MARKER = Path.home() / ".mt-eval" / ".crk-ip-acknowledged"

IP_NOTICE_TEXT = """\
══════════════════════════════════════════════════════════════════════════════
  Plains Cree (nêhiyawêwin) — DATA SOVEREIGNTY & RESPONSIBLE USE
══════════════════════════════════════════════════════════════════════════════
  The Cree LYSS validation standard and any Plains Cree language data are
  treated as the PROPERTY OF THE nêhiyaw LANGUAGE COMMUNITY, offered for
  NON-COMMERCIAL, community-benefit use (relational-trust governance in
  progress).

  Gloss data is fetched live from the public itwêwina API and cached locally
  for your OWN use only. The underlying dictionary content (Wolvengrey CW,
  Maskwacîs MD, AECD) is NOT openly licensed — do NOT commit, redistribute,
  publish, or bundle the cache. The Cree FST (GiellaLT/ALTLab, AGPL) is
  downloaded and invoked as a SEPARATE tool, never bundled.

  By proceeding you agree to respect these terms.
  Set CHAMPOLLION_LYSS_ACCEPT_IP=1 to acknowledge in automation.
══════════════════════════════════════════════════════════════════════════════
"""

# Process-level memo: the notice prints once and the decision stays stable.
_resolved: bool | None = None
_warned: bool = False


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in ("1", "true", "yes", "on", "y")


def _emit_notice_once() -> None:
    """Log + print the notice exactly once per process (always, on any path)."""
    global _warned
    if _warned:
        return
    _warned = True
    logger.warning(
        "Plains Cree LYSS: use-by-permission standard (interim, pending "
        "community governance); itwêwina gloss content is not openly licensed "
        "and is fetched live, cached do-not-redistribute. See the package NOTICE."
    )
    try:
        print(IP_NOTICE_TEXT, file=sys.stderr)
    except Exception:
        pass  # never let notice rendering break a run


def _remember() -> None:
    """Persist an acknowledgment marker so humans aren't re-prompted."""
    try:
        _ACK_MARKER.parent.mkdir(parents=True, exist_ok=True)
        _ACK_MARKER.write_text(
            "Plains Cree LYSS IP / data-sovereignty terms acknowledged.\n"
            "Delete this file to be prompted again. See the package NOTICE.\n",
            encoding="utf-8",
        )
    except OSError:
        pass  # best-effort; never fatal


def acknowledge_ip(*, interactive: bool | None = None) -> bool:
    """Return True iff the user has acknowledged the Cree IP/sovereignty terms.

    Side effects: prints the notice once per process; may prompt interactively;
    may write a remembered-acknowledgment marker. Never raises. The decision is
    memoized for the process.

    Args:
        interactive: Force interactive/non-interactive behavior. When None,
            auto-detect from whether stdin and stdout are both TTYs.
    """
    global _resolved
    if _resolved is not None:
        return _resolved

    _emit_notice_once()

    # 1. Remembered acknowledgment.
    try:
        if _ACK_MARKER.exists():
            logger.info(
                "Plains Cree LYSS IP terms previously acknowledged (%s).", _ACK_MARKER
            )
            _resolved = True
            return True
    except OSError:
        pass

    # 2. Explicit env acknowledgment.
    if _truthy(os.environ.get(ACCEPT_ENV)):
        _remember()
        _resolved = True
        return True

    # 3. Non-interactive / CI auto-consent (notice already printed).
    if interactive is None:
        interactive = sys.stdin.isatty() and sys.stdout.isatty()
    auto = (
        bool(os.environ.get("CI"))
        or bool(os.environ.get("MT_EVAL_AUTO_SETUP"))
        or not interactive
    )
    if auto:
        logger.warning(
            "Plains Cree LYSS: proceeding under non-interactive auto-consent. "
            "Set %s=1 to acknowledge explicitly.",
            ACCEPT_ENV,
        )
        _resolved = True
        return True

    # 4. Interactive prompt.
    try:
        answer = input(
            "  Acknowledge and respect these terms to use Cree glosses? [y/N]: "
        ).strip().lower()
    except (EOFError, KeyboardInterrupt):
        answer = ""
    ok = answer in ("y", "yes")
    if ok:
        _remember()
    else:
        logger.warning(
            "Plains Cree LYSS IP terms not acknowledged — gloss lookups disabled; "
            "gloss-dependent scores will be reported as unavailable (not fabricated)."
        )
    _resolved = bool(ok)
    return _resolved


def _reset_state_for_tests() -> None:
    """Clear the process-level memo. Used by the test suite to isolate cases."""
    global _resolved, _warned
    _resolved = None
    _warned = False
