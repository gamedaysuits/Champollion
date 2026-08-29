"""
Queue Runner — execute the top of the community compute queue.

The public queue (champollion.dev/queue.json) is ranked by expected
chain value: mesh improvement per estimated dollar (normative spec:
specifications/queue-construction on the arena site). This module turns
"contribute compute" into one command:

    mt-eval queue --budget 2.50       # run from the top until ~$2.50
                                      # of estimated spend
    mt-eval queue --top 5             # run the 5 best open items
    mt-eval queue --top 3 --dry-run   # show the plan, run nothing

Selection rules:
  - Items are taken in queue order — the ranking IS the priority
    model; the runner never re-sorts.
  - ``--budget X`` walks from the top keeping a running total of
    ``est_cost_usd`` within X; items with no estimate are skipped
    in budget mode (unknown is never treated as free). An item is
    only selected if its estimated cost fits ENTIRELY within the
    remaining budget — no partial runs.
  - ``--top N`` takes the first N runnable items.
  - Coached items are skipped unless ``--include-coached`` AND
    ``--coaching-file`` are given — a coached run without YOUR
    coaching file is meaningless. The file you provide replaces the
    placeholder in the item's run_command.

Budget guard:
  After each completed run, actual cost is read from the report
  JSON. Before starting the next item, the runner checks whether
  ``actual_spend_so_far + est_next_item > budget``. If actual
  costs are tracking higher than estimated, the batch stops early
  rather than exceeding the stated budget. Contributors are never
  charged more than they agreed to.

Safety:
  - Prints the full plan with estimated spend and asks for
    confirmation before spending anything (``--yes`` skips, for cron).
  - Refuses to start without a valid API key for the selected
    provider (auto-detected or specified with ``--provider``).
  - A failing item does not stop the batch by default (each item is
    independent evidence); ``--stop-on-failure`` makes it strict.

Publishing:
  Results are auto-published to the leaderboard after each
  successful run. Pass ``--no-publish`` to skip auto-publishing
  (you can always publish manually later with ``mt-eval publish``).
  The publishing identity is resolved once at the start of the
  batch — before any tokens are spent — via a three-way door
  (founder directive 2026-07-13: OAuth optional, not required):
  sign in (results attributed to you), continue anonymously
  (submitter 'anonymous'; ``--anonymous`` forces it, and
  non-interactive runs with no cached sign-in default to it,
  loudly), or ``--no-publish``.

  The anonymous intake rate-limits per IP (a few cards per hour).
  When a batch outruns that window, publishes are DEFERRED — not
  failed: a shared gate pauses attempts and re-probes every few
  minutes while runs continue, and the end-of-batch summary prints
  ONE re-publish command (``mt-eval publish --republish-dir
  eval/logs/harness/queue --anonymous --prod``) covering every
  report still on disk. (2026-07-19 $100 wave: 349 runs completed,
  76 published, 273 scattered per-item hints — the failure this
  design retires.)
"""

from __future__ import annotations

import argparse
import glob
import hashlib
import json
import logging
import math
import os
import random
import re
import signal
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import NamedTuple

logger = logging.getLogger(__name__)

DEFAULT_QUEUE_URL = "https://champollion.dev/queue.json"

# DB-as-queue (B1): the live queue is served from Postgres (the queue_top RPC),
# coverage-filtered against VERIFIED runs, so a contributor never spends money
# re-running work already refereed. `--queue db` (the default) pages the RPC and
# pulls metadata from the small queue-preview.json, falling back to the static
# queue.json blob if the DB is unreachable — so the run flow never breaks.
# An explicit `--queue <url-or-file>` bypasses the DB entirely.
DB_QUEUE_SENTINEL = "db"
# 'blob' forces the static queue.json blob. The MCP server's queue tools have
# always accepted CHAMPOLLION_QUEUE_SOURCE=blob; without this sentinel the
# harness read the same env var as a literal file path and died with
# "Queue file not found: blob" whenever the two shared an environment.
BLOB_QUEUE_SENTINEL = "blob"
DEFAULT_QUEUE_SOURCE = os.environ.get("CHAMPOLLION_QUEUE_SOURCE", DB_QUEUE_SENTINEL)
QUEUE_PREVIEW_URL = "https://champollion.dev/queue-preview.json"
QUEUE_SUPABASE_URL = os.environ.get(
    "MT_EVAL_SUPABASE_URL", "https://sjdomynysdljkbemupqa.supabase.co")
QUEUE_SUPABASE_ANON_KEY = os.environ.get(
    "MT_EVAL_SUPABASE_ANON_KEY", "sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp")
QUEUE_TOP_PAGE = 500  # matches the RPC's hard page cap
# Served item fields (what queue.json publishes); queue_top rows also carry
# rank_mode/map_value/diagnostics/generation_id/generated_at, projected away so
# DB-sourced items match the blob shape select_items expects.
_QUEUE_SERVED_FIELDS = (
    "priority", "id", "language_pair", "source_language", "target_language",
    "corpus_id", "corpus_license", "entry_count", "contamination", "domain",
    "source_length", "model", "condition", "est_cost_usd", "est_basis",
    "run_command",
)

COACHING_PLACEHOLDER = "YOUR_COACHING.txt"

# Default report output directory (must match config.DEFAULT_OUTPUT_DIR)
DEFAULT_OUTPUT_DIR = "eval/logs/harness"

# Maps provider names to the environment variable that holds the API key.
# These match the providers in mt_eval_harness.providers.registry.
PROVIDER_KEY_MAP: dict[str, str] = {
    "openrouter": "OPENROUTER_API_KEY",
    "openai":     "OPENAI_API_KEY",
    "anthropic":  "ANTHROPIC_API_KEY",
    "gemini":     "GOOGLE_API_KEY",
    # Local / OpenAI-compatible (Ollama, vLLM, …) is keyless by default and an
    # explicit opt-in (--provider local) — never auto-detected. Listed LAST and
    # mapped to OPENAI_API_KEY only for gateways (Groq/Together) that need auth;
    # because "openai" is checked first, a set OPENAI_API_KEY resolves to openai,
    # not local.
    "local":      "OPENAI_API_KEY",
}


def detect_provider() -> str | None:
    """Auto-detect the best available provider by scanning for API keys.

    Checks environment variables in priority order. Returns the
    provider name string (e.g. 'openrouter') or None if no key is
    found anywhere.

    Priority order: openrouter first (it proxies all models), then
    direct providers in alphabetical order.
    """
    for provider_name, env_var in PROVIDER_KEY_MAP.items():
        if os.environ.get(env_var):
            return provider_name

    # Also check .env/.env.local files via dotenv
    try:
        from dotenv import dotenv_values, find_dotenv
        for filename in (".env.local", ".env"):
            env_path = find_dotenv(filename=filename, usecwd=True)
            if env_path:
                values = dotenv_values(env_path)
                for provider_name, env_var in PROVIDER_KEY_MAP.items():
                    if values.get(env_var):
                        return provider_name
    except ImportError:
        pass

    return None


def _keys_present(env_vars: list[str]) -> list[str]:
    """Return which of ``env_vars`` currently hold a value — process env first,
    then a local ``.env.local`` / ``.env`` (same scan order as
    :func:`detect_provider`). Best-effort; dotenv is optional. Used only to
    decide whether to surface the "a direct vendor key is also set" notice.
    """
    present = [v for v in env_vars if os.environ.get(v)]
    found = set(present)
    try:
        from dotenv import dotenv_values, find_dotenv
        for filename in (".env.local", ".env"):
            env_path = find_dotenv(filename=filename, usecwd=True)
            if not env_path:
                continue
            values = dotenv_values(env_path)
            for v in env_vars:
                if v not in found and values.get(v):
                    present.append(v)
                    found.add(v)
    except ImportError:
        pass
    return present


def _direct_key_notice(provider_explicit: bool, provider_name: str) -> str | None:
    """Return the one-line "a direct vendor key is also set" notice, or None.

    OpenRouter proxies every model regardless of its vendor prefix, so a
    contributor who also set a direct vendor key (and expected, say,
    ``anthropic/*`` models to bill ``ANTHROPIC_API_KEY``) might be surprised
    they routed through OpenRouter. We surface that — and how to override —
    only when it's actionable: the provider was auto-detected (not an explicit
    ``--provider``) as openrouter AND at least one direct vendor key is present.
    """
    if provider_explicit or provider_name != "openrouter":
        return None
    direct_vars = [v for k, v in PROVIDER_KEY_MAP.items()
                   if k not in ("openrouter", "local")]
    present = _keys_present(direct_vars)
    if not present:
        return None
    return (
        f"Every model routes through OpenRouter. A direct vendor key is also "
        f"set ({', '.join(present)}); pass --provider <openai|anthropic|gemini> "
        f"to bill it directly for a single-vendor batch."
    )


class QueueUnavailableError(RuntimeError):
    """The queue source responded, but not with the queue JSON.

    Typical cause: champollion.dev serving its HTML holding page over
    HTTP 200 while the site is gated or down. ``run_from_args`` renders
    this as a one-line error instead of a raw JSONDecodeError traceback.
    """


def load_queue_from_db(top: int | None = None,
                       include_coached: bool = False) -> dict:
    """Serve the live queue from Postgres: items paged from the queue_top RPC
    (coverage-filtered against VERIFIED runs), metadata from queue-preview.json.
    Raises so load_queue can fall back to the static blob.

    ``top``: stop paging once enough selectable items for a deterministic
    ``--top N`` run are in hand (N eligible rows plus one page of margin for
    the later coverage skip), instead of draining the whole ranking — the live
    queue is six figures deep (211k+ items as of 2026-08), and a full drain is
    ~423 sequential RPC pages ≈ 3 minutes. ``top=None`` keeps the full drain
    (budget mode legitimately scans arbitrarily deep for cheaper items).
    ``include_coached`` mirrors select_items' eligibility so the bound counts
    the same rows selection will."""
    with urllib.request.urlopen(QUEUE_PREVIEW_URL, timeout=30) as resp:
        preview = json.loads(resp.read())
    metadata = preview.get("metadata")
    if not isinstance(metadata, dict):
        raise QueueUnavailableError("queue-preview.json is missing metadata")
    rank_mode = metadata.get("rank_mode") or "map"

    # One page of margin absorbs rows the post-load coverage skip
    # (_drop_covered) may remove — published-but-not-yet-verified combos that
    # queue_top's own verified-only filter still serves.
    target = None if top is None else top + QUEUE_TOP_PAGE
    eligible = 0
    complete = True
    items: list[dict] = []
    offset = 0
    while True:
        payload = json.dumps({
            "p_rank_mode": rank_mode,
            "p_limit": QUEUE_TOP_PAGE, "p_offset": offset,
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{QUEUE_SUPABASE_URL}/rest/v1/rpc/queue_top",
            data=payload, method="POST",
            headers={
                "apikey": QUEUE_SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {QUEUE_SUPABASE_ANON_KEY}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            page = json.loads(resp.read())
        if not isinstance(page, list):
            raise QueueUnavailableError("queue_top did not return an array")
        for row in page:
            item = {f: row[f] for f in _QUEUE_SERVED_FIELDS if f in row}
            # The restricted-corpus `transmission` stamp is a SERVED extra on
            # queue.json, but it is not a queue_items COLUMN — the ranker
            # writes it into the diagnostics JSONB. Projecting columns alone
            # therefore dropped it from every DB-served item, and the
            # pre-spend plan stopped disclosing the channel requirement for
            # the license-restricted corpora in the queue (280 WMT
            # research-use items at the time of writing). Lift it back so the
            # DB path and the blob path disclose identically.
            stamp = (row.get("diagnostics") or {}).get("transmission")
            if isinstance(stamp, dict) and stamp.get("policy"):
                item["transmission"] = stamp
            items.append(item)
            if include_coached or item.get("condition") != "coached":
                eligible += 1
        if len(page) < QUEUE_TOP_PAGE:
            break
        if target is not None and eligible >= target:
            complete = False
            break
        offset += QUEUE_TOP_PAGE

    out_metadata = {**metadata}
    if complete:
        # open_items reflects the LIVE served count, not the last generation's
        # stat — but only a full drain can know it. A bounded top-N load keeps
        # the preview's generation-time count instead of lying with the prefix
        # length.
        out_metadata["open_items"] = len(items)
    return {"metadata": out_metadata, "items": items}


def load_queue(source: str, *, top: int | None = None,
               include_coached: bool = False) -> dict:
    """Load the queue: from the live DB (source 'db', the default), the static
    blob (source 'blob'), an http(s) URL, or a local file path.

    ``top``/``include_coached`` are DB-path depth hints (see
    load_queue_from_db) — a deterministic ``--top N`` run pages only as deep
    as its selection needs. They are ignored for URL/file sources, which are
    whatever queue.json those sources hold.

    Raises QueueUnavailableError when the source responds with something
    other than JSON (e.g. an HTML holding page while the site is gated
    or down) so callers can fail with a clear one-liner.
    """
    degraded_reason = ""
    if source == BLOB_QUEUE_SENTINEL:
        source = DEFAULT_QUEUE_URL
    if source == DB_QUEUE_SENTINEL:
        try:
            if top is None:
                # Zero-arg call preserved for injectability/back-compat.
                return load_queue_from_db()
            return load_queue_from_db(top=top, include_coached=include_coached)
        except Exception as exc:  # any DB/preview failure → static blob
            logger.warning(
                "live DB queue unavailable (%s) — falling back to %s",
                exc, DEFAULT_QUEUE_URL,
            )
            degraded_reason = str(exc) or exc.__class__.__name__
            source = DEFAULT_QUEUE_URL
    def _stamp(queue: dict) -> dict:
        """Mark a queue that came from the fallback, so an empty result can be
        reported as an OUTAGE rather than as "no work available"."""
        if degraded_reason and isinstance(queue, dict):
            queue.setdefault("metadata", {})["_degraded_from_db"] = degraded_reason
        return queue

    from mt_eval_harness.net_json import NotJSONResponseError, parse_json_response
    if source.startswith(("http://", "https://")):
        with urllib.request.urlopen(source, timeout=30) as resp:
            content_type = resp.headers.get("Content-Type", "")
            body = resp.read()
        try:
            return _stamp(parse_json_response(body, content_type=content_type,
                                              source=source))
        except NotJSONResponseError as exc:
            host = urllib.parse.urlsplit(source).netloc or source
            raise QueueUnavailableError(
                f"{host} is not serving the queue (got {exc.got}) — the site "
                f"may be gated or down; pass --queue <url-or-file> or try later"
            ) from exc
    try:
        return _stamp(json.loads(Path(source).read_text(encoding="utf-8")))
    except json.JSONDecodeError as exc:
        raise QueueUnavailableError(
            f"{source} is not queue JSON ({exc.msg} at line {exc.lineno}) — "
            f"pass --queue <url-or-file> pointing at a queue.json"
        ) from exc


def queue_health_error(queue: dict, source: str) -> str:
    """An outage message when the queue we hold is not a usable work-list.

    Returns "" when the queue is healthy. A contributor who offers compute and
    is told "No runnable items matched the selection" reasonably concludes the
    work is done; when the real cause is a failed DB fetch landing on a stub
    blob, that is an OUTAGE and must read as one. Prod has served the 0-item
    `ensure-network-artifacts.mjs` stub, so this is not hypothetical.
    """
    metadata = queue.get("metadata") or {}
    items = queue.get("items") or []
    degraded = metadata.get("_degraded_from_db")
    generated_by = str(metadata.get("generated_by") or "")
    is_stub = "stub" in generated_by.lower()

    if degraded and not items:
        return (
            "Queue outage: the live queue database could not be reached "
            f"({degraded}), and the static fallback at {DEFAULT_QUEUE_URL} "
            "carries no items. This is an outage, not an empty work-list — "
            "nothing was run and nothing was spent. Try again shortly, or "
            "pass --queue <url-or-file> to run from a queue you hold."
        )
    if is_stub or (not items and not degraded):
        detail = (" (the source is serving a placeholder artifact, not a "
                  "generated queue)" if is_stub else "")
        return (
            f"Queue outage: {source} answered but published no items"
            f"{detail}. This is an outage, not an empty work-list — nothing "
            "was run and nothing was spent. Try again shortly, or pass "
            "--queue <url-or-file> to run from a queue you hold."
        )
    if degraded:
        # Reachable fallback WITH items: degraded but usable. Say so loudly and
        # keep going — a contributor offering compute should still get work.
        return ""
    return ""


# Anti-collision: when many contributors run the donate/budget flow at the
# same moment, a strict "take the top N" hands every worker the identical
# items — N independent runs of the same (model, corpus) pair, N× the donated
# spend for one leaderboard row. Spreading selection with a priority-weighted
# random order keeps high-value items running most often while making it
# vanishingly unlikely that 1,000 simultaneous workers pile onto the same
# item. Replication stays possible (it is scientifically useful); a
# 100×-the-same-item dogpile does not.
#
# SPREAD_DECAY sets how fast selection probability falls with queue rank: an
# item at rank r is weighted exp(-r / SPREAD_DECAY). Larger = flatter = wider
# fan-out (less dogpile) at the cost of a gentler priority tilt.
#
# Tuned empirically against the REAL queue (variable item cost), NOT a uniform-
# cost toy: at the default donate budget ($2) a worker takes ~30 items, and the
# earlier value 300.0 piled the busiest item onto ~40% of 1,000 simultaneous
# workers — cheap top-ranked items get packed into nearly everyone's budget.
# 750.0 cuts that to ~14% while preserving the priority tilt (rank-0 still
# ~3.3x a deep-tail item; exp(900/750)≈3.32 > the 3x floor the tilt test
# guards). The residual ~12-14% is harmless and intentional: identical runs
# dedupe on publish (same fingerprint UUID, immutable row), and event-driven
# queue regen drops a pair shortly after the first publish so later workers
# don't repeat it. Flatter decay barely helps (a cheap-item floor ~12% that
# decay alone can't break) and erodes the tilt. See test_queue_spread.py.
SPREAD_DECAY = 750.0


def _spread_order(
    items: list[dict],
    rng: "random.Random",
    decay: float = SPREAD_DECAY,
) -> list[dict]:
    """Return a priority-weighted random permutation of ``items``.

    Uses the Efraimidis–Spirakis weighted-sampling key: each item at rank
    ``r`` (its position in the priority ranking) gets a sort key
    ``rng.random() ** (1 / weight)`` with ``weight = exp(-r / decay)``, and
    items are ordered by that key descending. Higher-priority (lower-rank)
    items tend to land at the front — so they run most often — but every item
    has a chance to surface early, so simultaneous workers fan out across the
    whole queue instead of all taking the same prefix.
    """
    if decay <= 0 or len(items) <= 1:
        return list(items)
    keyed: list[tuple[float, int, dict]] = []
    for rank, item in enumerate(items):
        weight = math.exp(-rank / decay)
        # rng.random() in [0,1); with weight>0 the key is well-defined. A
        # draw of exactly 0.0 yields key 0.0 (sorts last), which is fine.
        key = rng.random() ** (1.0 / weight)
        keyed.append((key, rank, item))
    # Highest key first; rank breaks ties deterministically.
    keyed.sort(key=lambda t: (-t[0], t[1]))
    return [item for _key, _rank, item in keyed]


def select_items(
    queue: dict,
    *,
    top: int | None = None,
    budget: float | None = None,
    include_coached: bool = False,
    spread: bool = False,
    rng: "random.Random | None" = None,
    decay: float = SPREAD_DECAY,
) -> tuple[list[dict], list[tuple[str, str]]]:
    """Pick items from the top of the ranking.

    Returns (selected, skipped) where skipped is [(item id, reason)].
    Exactly one of top/budget must be set (validated by the CLI layer).

    Budget mode guarantees:
      - An item is selected only if its estimated cost fits entirely
        within the remaining budget (no partial runs).
      - Items with no cost estimate are skipped (unknown ≠ free).
      - Items that would push cumulative estimated cost over the budget
        are skipped, but scanning continues — a cheaper item further
        down may still fit.

    Anti-collision: with ``spread=True`` the candidate order is a
    priority-weighted random permutation (see ``_spread_order``) before
    selection, so simultaneous workers do not all pick the same top items.
    Default is ``spread=False`` (deterministic top-order, which the shared
    selection vectors and the JS port rely on) — the CLI turns spread on for
    the ``--budget`` donate flow. Pass ``rng`` (a ``random.Random``) for
    reproducible selection.

    SSOT: This is the canonical implementation. A JS port exists at
    mcp-server/src/tools/queue.js (filterQueue). Both are tested
    against shared/queue-selection-vectors.json — if you change
    behavior here, update the vectors and run both test suites.
    """
    items = list(queue.get("items", []))
    if spread:
        items = _spread_order(items, rng or random.Random(), decay)

    selected: list[dict] = []
    skipped: list[tuple[str, str]] = []
    spend = 0.0
    for item in items:
        if top is not None and len(selected) >= top:
            break
        if item.get("condition") == "coached" and not include_coached:
            skipped.append((item["id"], "coached (no --include-coached)"))
            continue
        est = item.get("est_cost_usd")
        if budget is not None:
            if est is None:
                skipped.append((item["id"], "no cost estimate (budget mode)"))
                continue
            if spend + est > budget:
                # Keep scanning: a cheaper item further down may still fit.
                skipped.append((item["id"], "would exceed budget"))
                continue
            spend += est
        selected.append(item)
    return selected, skipped


def _extract_error_hint(output: str) -> str:
    """Pull the one-line useful error from subprocess output.

    When ``mt-eval run`` fails, it may emit a multi-line traceback.
    Instead of showing all of that to the user, we extract the
    meaningful line — the RuntimeError message, the "✗" line from
    the clean handler, or the first HTTP error code.
    """
    if not output:
        return ""

    # cli.py's clean handler prints "  ✗ <message>"
    for line in output.splitlines():
        stripped = line.strip()
        if stripped.startswith("✗ "):
            return stripped[2:].strip()

    # Look for RuntimeError/ValueError messages (the raise line)
    for line in reversed(output.splitlines()):
        stripped = line.strip()
        if stripped.startswith("RuntimeError:") or stripped.startswith("ValueError:"):
            # Strip the exception class prefix
            _, _, msg = stripped.partition(":")
            return msg.strip()[:160]

    # Look for HTTP error codes in the output
    for pattern in ("HTTP 401", "HTTP 402", "HTTP 403", "HTTP 404", "HTTP 400"):
        if pattern in output:
            # Find the line containing it
            for line in output.splitlines():
                if pattern in line:
                    return line.strip()[:160]

    # Last resort: the last non-empty line (usually the error)
    for line in reversed(output.splitlines()):
        stripped = line.strip()
        if stripped and not stripped.startswith("File ") and not stripped.startswith("at "):
            return stripped[:160]

    return ""


def _prompt_reenter_key(env_var: str) -> str | None:
    """Prompt the user to paste a new API key after a failure.

    Returns the new key string, or None if the user declines/cancels.
    Persists the key to .env.local so future runs don't need to ask.
    """
    print(f"  Paste your {env_var} below (or press Enter to stop):")
    try:
        key = input("  → ").strip()
    except (EOFError, KeyboardInterrupt):
        print("\n  Cancelled.")
        return None

    if not key:
        return None

    # Persist to .env.local so the user doesn't have to do this again
    env_file = Path.home() / ".env.local"
    try:
        existing = env_file.read_text() if env_file.exists() else ""
        lines = existing.splitlines()
        # Replace existing line or append
        replaced = False
        new_lines = []
        for line in lines:
            if line.startswith(f"{env_var}="):
                new_lines.append(f"{env_var}={key}")
                replaced = True
            else:
                new_lines.append(line)
        if not replaced:
            new_lines.append(f"{env_var}={key}")
        env_file.write_text("\n".join(new_lines) + "\n")
        env_file.chmod(0o600)
        print(f"  ✓ Saved to {env_file} (chmod 600)")
    except OSError as e:
        # Non-fatal — we still have it in the environment for this session
        logger.warning("Could not persist key to %s: %s", env_file, e)

    return key


def transmission_plan_marker(item: dict) -> str:
    """Plan-row marker for an item whose corpus carries a queue-stamped
    transmission restriction ('' for the unrestricted common case).

    The queue generator stamps restricted-but-queueable corpora (today the
    WMT research-use sets, founder-pinned no-train) with a ``transmission``
    block; this surfaces it in the confirmation plan so a donor sees the
    channel requirement BEFORE any token is spent. The marker is
    DISCLOSURE — enforcement lives in the per-item ``mt-eval run`` child
    (transmission_policy resolution against the registry; strategies
    attach the OpenRouter ``provider`` preference to every request).
    """
    stamp = item.get("transmission")
    if isinstance(stamp, dict) and stamp.get("policy"):
        return f"  [{stamp['policy']}]"
    return ""


def add_queue_arguments(parser: argparse.ArgumentParser) -> None:
    """Attach the queue-runner flags (shared by `mt-eval queue` and the
    standalone scripts/run_queue.py)."""
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--top", type=int, metavar="N",
                       help="Run the first N runnable items.")
    group.add_argument("--budget", type=float, metavar="USD",
                       help="Run items from the top while estimated "
                            "spend stays within this amount.")
    parser.add_argument("--queue", default=DEFAULT_QUEUE_SOURCE,
                        help="Queue source: 'db' (live DB via queue_top, the "
                             "default; falls back to the static blob), or an "
                             "http(s) URL / local path to a queue.json "
                             "(default: %(default)s)")
    parser.add_argument("--include-coached", action="store_true",
                        help="Allow coached items (requires --coaching-file).")
    parser.add_argument("--coaching-file", default=None,
                        help="Your coaching file, substituted into coached "
                             "items' run commands.")
    parser.add_argument("--provider", default=None,
                        choices=list(PROVIDER_KEY_MAP.keys()),
                        help="LLM API provider. Auto-detected from your "
                             "environment if not specified. "
                             "(%(choices)s)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print the plan and exit without running "
                             "anything.")
    parser.add_argument("--stop-on-failure", action="store_true",
                        help="Abort the batch on the first failing item.")
    parser.add_argument("--yes", "-y", action="store_true",
                        help="Skip the confirmation prompt (cron use).")
    parser.add_argument("--no-publish", action="store_true",
                        help="Skip auto-publishing after each run. Results "
                             "can still be published manually later with "
                             "'mt-eval publish'.")
    parser.add_argument("--anonymous", action="store_true",
                        help="Publish results WITHOUT signing in — the "
                             "leaderboard shows submitter 'anonymous'. No "
                             "account needed; sign in only if you want your "
                             "name on the board. (Non-interactive runs with "
                             "no cached sign-in default to this.)")
    parser.add_argument("--jobs", "-j", type=int, default=None, metavar="N",
                         help="Number of queue items to run concurrently "
                              "(default: 8, or 1 for ≤3 items). Higher "
                              "values finish faster but may hit API rate "
                              "limits.")
    parser.add_argument("--timeout", type=int, default=300, metavar="SECS",
                         help="Per-item timeout in seconds (default: 300). "
                              "Items exceeding this are killed and skipped.")
    spread_group = parser.add_mutually_exclusive_group()
    spread_group.add_argument(
        "--spread", dest="spread", action="store_true", default=None,
        help="Spread selection across a priority band so simultaneous "
             "contributors don't all run the same items (default for "
             "--budget, the donate flow).")
    spread_group.add_argument(
        "--no-spread", dest="spread", action="store_false",
        help="Disable anti-collision spread; take items in strict queue "
             "order (default for --top).")
    parser.add_argument("--spread-seed", type=int, default=None, metavar="N",
                        help="Seed the spread RNG for reproducible selection "
                             "(testing/debugging).")


# ---------------------------------------------------------------------------
# Post-run helpers
# ---------------------------------------------------------------------------

def _find_latest_report(item: dict) -> Path | None:
    """Find the most recent report file matching a queue item.

    The ``mt-eval run`` command writes reports to eval/logs/harness/
    with the naming convention ``run_<timestamp>_report.json``. We
    match on the corpus stem and model slug found inside the report to
    avoid picking up an unrelated report.
    """
    output_dir = Path(DEFAULT_OUTPUT_DIR)
    if not output_dir.is_dir():
        return None

    # Build expected identifiers from the queue item to match
    # against report contents.
    item_corpus = item.get("corpus_stem", "")
    item_model = item.get("model", "")

    # Get all report files sorted by modification time (newest first)
    reports = sorted(
        output_dir.glob("run_*_report.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    for report_path in reports[:10]:  # Only check recent reports
        try:
            data = json.loads(report_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        # Match by corpus filename and model slug
        config = data.get("config", {})
        report_corpus = Path(config.get("corpus_path", "")).stem
        report_model = config.get("model", "")

        # The queue item's corpus_stem is derived from the corpus filename
        # (e.g., "eng-crk-dev-v1") and the model slug matches the full
        # OpenRouter path (e.g., "anthropic/claude-haiku-4.5").
        if item_corpus and item_corpus in report_corpus:
            if item_model and item_model in report_model:
                return report_path
        # Fallback: just return the newest report if it was created
        # within the last 60 seconds (the run just finished)
        import time
        if time.time() - report_path.stat().st_mtime < 60:
            return report_path

    return None


def _read_report_cost(report_path: Path) -> float:
    """Extract actual cost from a TestReport JSON.

    Returns 0.0 if the file can't be read or lacks cost data.
    """
    try:
        data = json.loads(report_path.read_text(encoding="utf-8"))
        return float(data.get("overall", {}).get("total_cost_usd", 0.0))
    except (json.JSONDecodeError, OSError, TypeError, ValueError):
        return 0.0


def _read_report_chrf(report_path: Path) -> float | None:
    """Extract chrF++ score from a TestReport JSON."""
    try:
        data = json.loads(report_path.read_text(encoding="utf-8"))
        return data.get("overall", {}).get("avg_chrf")
    except (json.JSONDecodeError, OSError, TypeError, ValueError):
        return None


def _find_report_in_dir(report_dir: str | Path) -> Path | None:
    """Find the report this item wrote to its OWN isolated output dir.

    Each queue item runs with a unique ``--output-dir`` (see the pre-build
    loop), so its directory contains exactly one ``*_report.json``. This is
    collision-free under concurrency, unlike the shared-dir, newest-wins
    heuristic in ``_find_latest_report`` (which cross-matches when several
    items finish within the same 60-second window).
    """
    d = Path(report_dir)
    if not d.is_dir():
        return None
    reports = sorted(
        d.glob("*_report.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return reports[0] if reports else None


class PublishOutcome(NamedTuple):
    """Result of one ``_auto_publish`` call.

    ``ok=True`` → the run is on the board. ``rate_limited=True`` → deferred
    by the anonymous intake's per-IP/global cap — NOT an error; the report
    stays on disk and the end-of-batch summary prints the single re-publish
    command. Neither flag → a genuine publish failure (per-item hint shown).
    """
    ok: bool
    rate_limited: bool = False
    retry_after: float | None = None


# After a hard anonymous-intake 429, hold OFF further publish attempts for
# this long, then let the next completed item probe the window again. The
# intake's per-IP window is rolling (default 5/hour), so slots free before
# the server's worst-case retry_after_seconds=3600 — probing every 10 min
# publishes at whatever rate the window actually allows (≤6 extra requests
# per hour) instead of either hammering every completion or going silent
# for a full hour.
PUBLISH_DEFER_PROBE_S = 600.0

_PUBLISH_GATE_LOCK = threading.Lock()
_PUBLISH_GATE = {"until": 0.0}  # wall-clock deadline; reset per batch


def _reset_publish_gate() -> None:
    """Clear the defer gate (start of every batch; test isolation)."""
    with _PUBLISH_GATE_LOCK:
        _PUBLISH_GATE["until"] = 0.0


def _auto_publish(report_path: str, label: str = "",
                  anonymous: bool = False) -> PublishOutcome:
    """Publish one report, swallowing EVERY failure mode. Returns a
    :class:`PublishOutcome`; only ever re-raises KeyboardInterrupt.

    ``publish_to_supabase`` raises ``SystemExit`` on a 4xx response, a failed
    integrity gate, a row-validation failure, or after exhausting its upload
    retries. ``SystemExit`` derives from ``BaseException``, so a bare
    ``except Exception`` does NOT catch it — which means, before this helper,
    a single bad publish would unwind the whole batch loop: every remaining
    paid item skipped, no end-of-run summary, the contributor's compute
    silently lost. This helper guarantees that can never happen.

    Rate limiting (2026-07-19 $100 wave: 349 runs completed, 76 published —
    the rest burned per-item hints against a closed hourly window): a hard
    intake 429 (``AnonymousRateLimitError``) arms a shared defer gate.
    While armed, publishes are skipped WITHOUT network I/O
    (``rate_limited=True``); after ``PUBLISH_DEFER_PROBE_S`` the next
    completion probes the window again. Deferred reports get NO per-item
    re-publish hint — the batch summary prints one block with one command.

    yes_prod=True: the queue lane IS the explicit prod opt-in. Publishing to
    the live leaderboard is this flow's stated purpose — the contributor saw
    "Results will be auto-published" in the plan banner, walked the Step-1
    publishing door, and confirmed the spend (or --yes echoed exactly what
    would publish and as whom). Without this, the C1 prod-write guard
    (publish.py, 2026-06-29) refused every donate-lane auto-publish on prod —
    the paid run completed and the publish fell back to "re-publish later"
    (defect found 2026-07-13 while building the anonymous lane).
    """
    where = f" for {label}" if label else ""
    now = time.time()
    with _PUBLISH_GATE_LOCK:
        gated = now < _PUBLISH_GATE["until"]
    if gated:
        return PublishOutcome(ok=False, rate_limited=True)

    try:
        from mt_eval_harness.publish import (AnonymousRateLimitError,
                                             publish_to_supabase)
    except (Exception, SystemExit) as exc:  # broken install — a publish failure
        print(f"    ⚠ Publish failed{where}: {exc}")
        return PublishOutcome(ok=False)

    try:
        publish_to_supabase(report_path, auto_confirm=True, yes_prod=True,
                            anonymous=anonymous)
        return PublishOutcome(ok=True)
    except KeyboardInterrupt:
        raise
    except AnonymousRateLimitError as exc:
        hold = min(exc.retry_after_seconds or PUBLISH_DEFER_PROBE_S,
                   PUBLISH_DEFER_PROBE_S)
        with _PUBLISH_GATE_LOCK:
            _PUBLISH_GATE["until"] = time.time() + hold
        print(f"    ⏸ Publish deferred{where} — the anonymous intake's "
              f"rate limit is reached.")
        print(f"      Pausing publish attempts for ~{int(hold // 60)} min "
              f"(runs continue; deferred reports are listed at the end).")
        return PublishOutcome(ok=False, rate_limited=True,
                              retry_after=exc.retry_after_seconds)
    except (Exception, SystemExit) as exc:
        anon_flag = " --anonymous --prod" if anonymous else " --prod"
        print(f"    ⚠ Publish failed{where}: {exc}")
        print(f"    → Re-publish later with: "
              f"mt-eval publish {report_path}{anon_flag}")
        return PublishOutcome(ok=False)


# Where the queue lane's per-item report dirs live — the target of the ONE
# re-publish command in the batch summary.
REPUBLISH_ROOT = str(Path(DEFAULT_OUTPUT_DIR) / "queue")


def _render_unpublished_block(deferred_n: int, failed_n: int, *,
                              anonymous: bool) -> list[str]:
    """The ONE end-of-batch block for unpublished results — a single
    re-publish command instead of a scattered hint per item (the 2026-07-19
    $100 wave printed 273 of those).

    Pointing the command at the whole queue output tree is safe: the
    duplicate pre-flight skips already-published reports read-only, so past
    batches cost no rate-limit slots.
    """
    total = deferred_n + failed_n
    parts = []
    if deferred_n:
        parts.append(f"{deferred_n} deferred by the anonymous intake's "
                     f"rate limit")
    if failed_n:
        parts.append(f"{failed_n} failed")
    flags = " --anonymous --prod" if anonymous else " --prod"
    lines = [
        "",
        f"  ⚠ {total} result(s) ran but did not publish "
        f"({', '.join(parts)}).",
        f"    Your compute is NOT lost — every report is saved under "
        f"{REPUBLISH_ROOT}/.",
        "    Re-publish them all with ONE command (already-published runs "
        "are skipped):",
        "",
        f"        mt-eval publish --republish-dir {REPUBLISH_ROOT}{flags}",
    ]
    if deferred_n and anonymous:
        lines += [
            "",
            "    The anonymous intake admits a few cards per hour per "
            "connection — the",
            "    command publishes what fits and says what remains; re-run "
            "it later, or",
            "    sign in (drop --anonymous) for unlimited, attributed "
            "publishing.",
        ]
    return lines


def _announce_anonymous() -> None:
    """The loud echo every anonymous run gets — what publishes, and as whom."""
    print("  → Publishing ANONYMOUSLY: each completed run posts to the public")
    print("    leaderboard as submitter 'anonymous' — not attributed to you.")
    print("    Sign in instead (interactive run without --anonymous) to be "
          "credited.")


def _publishing_door(args) -> tuple | None:
    """Step 1: resolve the publishing identity — the three-way door.

    Publishing requires NO account (founder directive 2026-07-13): results
    post either attributed (OAuth sign-in) or as submitter 'anonymous'. The
    third door, --no-publish, skips publishing entirely and is handled by
    the caller before this runs.

    Returns (submitter, anonymous) — submitter is None on the anonymous
    door — or None when the contributor declined every publishing path
    (the caller aborts before any tokens are spent).

      · --anonymous          → (None, True); auth is never touched
      · cached / env session → (name, False); silent reuse, so returning
                               donors stay attributed without a prompt
      · no tty (curl | bash) → (None, True) with the loud anonymous echo —
                               never blocked on OAuth
      · tty                  → a menu: sign in / continue anonymously; a
                               failed or cancelled sign-in offers the
                               anonymous door instead of dying
    """
    from mt_eval_harness.auth import (get_cached_session, get_session,
                                      get_submitter_name)

    if getattr(args, "anonymous", False):
        _announce_anonymous()
        return None, True

    session = get_cached_session()
    if session is not None:
        submitter = get_submitter_name(session)
        print(f"  ✓ Signed in as {submitter} (cached — pass --anonymous to "
              f"publish without attribution)")
        return submitter, False

    if not sys.stdin.isatty():
        # curl | bash and other non-interactive runs with no cached sign-in:
        # anonymous by default — publishing must never require an account.
        _announce_anonymous()
        print("    (Non-interactive run, no cached sign-in. To publish "
              "attributed: sign in once")
        print("    interactively — `mt-eval queue` — or set "
              "MT_EVAL_REFRESH_TOKEN.)")
        return None, True

    print("  Publishing is open to everyone — no account needed.")
    print("    [1] Sign in (GitHub/Google) — results attributed to your name")
    print("    [2] Continue anonymously   — results posted as 'anonymous'")
    for _ in range(3):
        try:
            choice = input("\n  > ").strip()
        except EOFError:
            # stdin closed mid-prompt — take the no-account door, loudly.
            print()
            _announce_anonymous()
            return None, True
        except KeyboardInterrupt:
            print()
            return None
        if choice in ("", "1"):
            try:
                session = get_session()
                return get_submitter_name(session), False
            except SystemExit:
                print("\n  Sign-in didn't complete.")
                try:
                    fallback = input(
                        "  Continue anonymously instead? [Y/n]: ").strip().lower()
                except (EOFError, KeyboardInterrupt):
                    print()
                    return None
                if fallback in ("", "y", "yes"):
                    _announce_anonymous()
                    return None, True
                return None
        if choice == "2":
            _announce_anonymous()
            return None, True
        print("  Please answer 1 or 2.")
    return None


# Markers used to tell a genuine auth/key problem (worth re-entering a key)
# apart from a transient rate-limit / timeout / provider blip (back off and
# keep going — do NOT stall the batch on a misleading "bad key" prompt).
_TRANSIENT_MARKERS = (
    "429", "rate limit", "rate_limit", "too many requests", "overloaded",
    "500", "502", "503", "504", "529", "timeout", "timed out",
    "temporarily", "connection", "network", "econnreset",
)
_AUTH_MARKERS = (
    "401", "403", "invalid api key", "invalid_api_key", "user not found",
    "no auth credentials", "unauthorized", "permission denied",
)


def _classify_failure(status: str, error_hint: str) -> str:
    """Bucket a failed/timed-out item: 'auth' | 'transient' | 'other'.

    The circuit breaker uses this so a burst of 429s or timeouts does NOT
    masquerade as a bad API key and stall the batch on a terminal prompt.
    Only genuine auth failures (401/403/invalid key) earn a key-re-entry
    offer; transient failures are absorbed and the batch keeps moving.

    Transient markers are checked first because some rate-limit response
    bodies also mention the word "key" — a 429 is a rate limit, not an auth
    problem, no matter what else is in the message.
    """
    if status == "timeout":
        return "transient"
    h = (error_hint or "").lower()
    if any(m in h for m in _TRANSIENT_MARKERS):
        return "transient"
    if any(m in h for m in _AUTH_MARKERS):
        return "auth"
    return "other"


# ---------------------------------------------------------------------------
# Coverage skip — don't re-run combos already on the leaderboard
# ---------------------------------------------------------------------------

def counts_toward_llm_auth_abort(item: dict, error_hint: str) -> bool:
    """True when a failed item's error should count toward the LLM-provider
    auth circuit breaker (3 consecutive → key re-entry prompt / abort).

    Engine items (condition == "engine") bill their OWN vendor keys
    (Microsoft, DeepL, …), so their 401/403s say nothing about the LLM
    provider key and never count — observed 2026-07-19: three consecutive
    Microsoft Translator 401s aborted a healthy batch blaming
    OPENROUTER_API_KEY, which had just completed 23 runs.
    """
    if item.get("condition") == "engine":
        return False
    return _classify_failure("failed", error_hint) == "auth"


def _fetch_published_combos() -> set | None:
    """Return {(dataset_id, model_slug, condition)} already on the leaderboard.

    Lets the queue skip combos a contributor (or another worker) has already
    completed, so donated compute moves THROUGH the lineup instead of re-running
    covered work. The match key is exact registry/slug strings — the queue
    item's (corpus_id, model, condition) equals the run_card's
    (dataset_id, model_slug, condition); no language-pair format ambiguity.

    Best-effort + read-only (anon, public SELECT). Returns None on ANY failure
    so the caller runs the full queue rather than blocking. Disable with
    MT_EVAL_NO_COVERAGE_SKIP=1.
    """
    if os.environ.get("MT_EVAL_NO_COVERAGE_SKIP", "").lower() in ("1", "true", "yes"):
        return None
    try:
        from mt_eval_harness.auth import SUPABASE_URL, SUPABASE_ANON_KEY
    except Exception:
        return None
    combos: set = set()
    page = 1000
    offset = 0
    try:
        while True:
            url = (f"{SUPABASE_URL}/rest/v1/run_cards"
                   f"?select=dataset_id,model_slug,condition&trust=neq.disqualified"
                   f"&limit={page}&offset={offset}&order=id.asc")
            req = urllib.request.Request(url, headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            })
            with urllib.request.urlopen(req, timeout=15) as resp:
                rows = json.loads(resp.read())
            for r in rows:
                combos.add((r.get("dataset_id"), r.get("model_slug"), r.get("condition")))
            if not isinstance(rows, list) or len(rows) < page:
                break
            offset += page
        return combos
    except Exception as e:  # network / parse / unreachable → don't filter
        logger.debug("coverage-skip: could not fetch published combos: %s", e)
        return None


def _drop_covered(items: list, covered: set) -> list:
    """Drop queue items whose (corpus_id, model, condition) is already on the
    leaderboard. Pure (no I/O) so it's unit-tested. Items missing any of the
    three keys simply won't match a covered tuple, so they're kept (safe)."""
    return [
        it for it in items
        if (it.get("corpus_id"), it.get("model"), it.get("condition")) not in covered
    ]


def _combo_published(
    corpus_id: str | None,
    model: str | None,
    condition: str | None,
    *,
    timeout: int = 10,
) -> bool:
    """True if a (corpus_id × model × condition) result is ALREADY on the
    public leaderboard — a per-item, just-before-run coverage recheck.

    This is the concurrency-safety counterpart to the batch-level
    ``_fetch_published_combos`` / ``_drop_covered`` (which run once, at
    selection time): a donate/budget batch can run for minutes, during which
    another contributor may publish the very item this worker is about to
    spend on. Re-checking immediately before each run keeps two simultaneous
    contributors from redoing the same (corpus, model, condition) — donated
    compute moves THROUGH the lineup instead of N workers piling onto one row.

    A targeted query (dataset_id + condition, with the model matched
    client-side against BOTH the full slug and its post-vendor short form,
    mirroring how the leaderboard stores either) keeps this cheap — a handful
    of rows, not the whole board.

    Best-effort + read-only (anon, public SELECT). ANY failure (disabled,
    missing fields, network, parse) returns False so a flaky read never blocks
    a legitimate run — the same fail-OPEN posture as the batch coverage skip.
    Disable entirely with ``MT_EVAL_NO_COVERAGE_SKIP=1``.
    """
    if os.environ.get("MT_EVAL_NO_COVERAGE_SKIP", "").lower() in ("1", "true", "yes"):
        return False
    if not corpus_id or not model or condition is None:
        return False
    try:
        from mt_eval_harness.auth import SUPABASE_URL, SUPABASE_ANON_KEY
    except Exception:
        return False
    # Accept either slug form on the board: full "anthropic/claude-haiku-4.5"
    # or the short "claude-haiku-4.5" — publish.py stores whichever the run
    # configured, so match against both to avoid a missed (and re-run) combo.
    want = {model.strip().lower(), model.split("/")[-1].strip().lower()}
    cond = (condition or "").strip()
    try:
        url = (
            f"{SUPABASE_URL}/rest/v1/run_cards"
            f"?select=model_slug"
            f"&dataset_id=eq.{urllib.parse.quote(corpus_id)}"
            f"&condition=eq.{urllib.parse.quote(cond)}"
            f"&trust=neq.disqualified&limit=200"
        )
        req = urllib.request.Request(url, headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        })
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            rows = json.loads(resp.read())
    except Exception as e:  # network / parse / unreachable → don't skip
        logger.debug("combo-skip: could not check %s/%s/%s: %s",
                     corpus_id, model, condition, e)
        return False
    if not isinstance(rows, list):
        return False
    for r in rows:
        ms = (r.get("model_slug") or "").strip().lower()
        if ms in want or ms.split("/")[-1] in want:
            return True
    return False


# ---------------------------------------------------------------------------
# Command construction — reconstruct argv locally, NEVER shell the network
# ---------------------------------------------------------------------------
#
# SECURITY: the queue is fetched over HTTP (champollion.dev/queue.json, or a
# user-supplied --queue). Its contents are UNTRUSTED. The item's
# ``run_command`` is a convenience string for humans to copy/paste; the runner
# must NOT hand it to a shell. A compromise of the static host/CDN, the
# queue-build pipeline, or a ``--queue`` redirect would otherwise be arbitrary
# code execution on every contributor's machine.
#
# Instead we reconstruct the ``mt-eval run`` argv LOCALLY from the item's
# structured fields and execute it with ``shell=False`` (a list, no
# interpolation). The corpus is always referenced by its registry id, which
# the harness resolves via the registry -> local file -> fetch-from-source
# chain — the same canonical path the documented contributor flow uses.

class QueueItemError(ValueError):
    """A queue item lacks the structured fields needed to safely build its run
    command, or a field fails validation. The runner skips such an item rather
    than fall back to executing its network-supplied ``run_command`` string in
    a shell."""


# The queue is untrusted, so even though we never shell the values we still
# validate each structured field against its expected shape. Because the argv
# is built positionally (``--flag value``), the residual risk is *argument*
# injection into mt-eval itself — chiefly a value that could be read as an
# option. We reject anything with a leading dash or control characters, plus
# anything outside the known id/slug character sets.
_CORPUS_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
_MODEL_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/:@-]*$")
_CTRL_RE = re.compile(r"[\x00-\x1f\x7f]")


def _require_str_field(item: dict, key: str) -> str:
    val = item.get(key)
    if not isinstance(val, str) or not val.strip():
        raise QueueItemError(f"missing or empty '{key}'")
    return val


def build_run_argv(
    item: dict,
    *,
    coaching_file: str | None = None,
    provider: str | None = None,
    output_dir: str | None = None,
) -> list[str]:
    """Reconstruct the ``mt-eval run`` argv for a queue item from its
    STRUCTURED fields — never from the network-supplied ``run_command``.

    Returns a ``list[str]`` for ``subprocess.Popen`` WITHOUT ``shell=True``.
    The corpus is referenced by its registry id (resolved by the harness via
    registry -> local file -> fetch-from-source), so this is faithful to both
    the hosted and fetch-from-source flows while never invoking a shell.

    Raises :class:`QueueItemError` if a required field is missing or fails
    validation; the caller skips the item — it is NEVER executed via a shell
    as a fallback.
    """
    corpus_id = _require_str_field(item, "corpus_id")
    model = _require_str_field(item, "model")
    target_language = _require_str_field(item, "target_language")

    if not _CORPUS_ID_RE.match(corpus_id):
        raise QueueItemError(f"corpus_id failed validation: {corpus_id!r}")
    if not _MODEL_RE.match(model):
        raise QueueItemError(f"model failed validation: {model!r}")
    # Language names may contain spaces, parentheses, commas and non-ASCII
    # letters (e.g. "Plains Cree (nêhiyawêwin, SRO)"). Reject only a leading
    # dash (would parse as an option) and control characters.
    if target_language.startswith("-") or _CTRL_RE.search(target_language):
        raise QueueItemError(
            f"target_language failed validation: {target_language!r}")

    # Engine items (condition == "engine": microsoft-translator,
    # google-translate, deepl, …) run through the consumer-reports adapters
    # via --method; everything else is an LLM run via --model. Passing an
    # engine slug as --model is an invalid config ("Unknown model").
    is_engine = item.get("condition") == "engine"
    argv = [
        "mt-eval", "run",
        "--corpus", corpus_id,
        "--method" if is_engine else "--model", model,
    ]
    # Source language rides along when the item carries it (queue items do
    # since 2026-07-19) — without it the harness's --source-lang defaults to
    # "English", mislabeling prompts on non-English-source corpora. Same
    # validation posture as target_language.
    source_language = item.get("source_language")
    if isinstance(source_language, str) and source_language.strip():
        if source_language.startswith("-") or _CTRL_RE.search(source_language):
            raise QueueItemError(
                f"source_language failed validation: {source_language!r}")
        argv += ["--source-lang", source_language]
    argv += [
        "--target-lang", target_language,
        "--yes",
    ]
    # Provider is a LOCAL value (auto-detected or an argparse-validated choice),
    # not network data. OpenRouter is the harness default, so only pass the
    # flag for an explicit non-default provider — and never for engine items,
    # whose adapters bill their own vendor keys.
    if provider and provider != "openrouter" and not is_engine:
        argv += ["--provider", provider]
    if output_dir:
        argv += ["--output-dir", str(output_dir)]
    if item.get("condition") == "coached":
        # Coached items are only selected with --include-coached, which the CLI
        # requires be paired with --coaching-file; guard anyway.
        if not coaching_file:
            raise QueueItemError(
                "coached item requires a coaching file (--coaching-file)")
        argv += ["--coaching-file", str(coaching_file)]
    return argv


# ---------------------------------------------------------------------------
# Sealed-set authorization — the `pending-authorization` queue state (Wave 1)
# ---------------------------------------------------------------------------
#
# A sealed (sovereign held-out) corpus is NOT auto-run on pickup. A sealed queue
# item stays `pending-authorization` until a valid — UNUSED, UNEXPIRED,
# FINGERPRINT-MATCHING — grant exists for it (the sovereign multisig plan, M2; the same
# three conditions migration 039's claim_auth_grant() asserts atomically at the
# DB). The real M-of-N threshold signing that PRODUCES a grant is Wave 2; Wave 1
# wires the queue state plus the data-layer grant-validity check.
#
# FAIL-CLOSED. The default grant lookup returns NOTHING, so a worker never
# auto-runs a sealed item: a sovereign set is only ever evaluated when a grant
# has explicitly been minted for this exact request. Sealed items that pass the
# gate still run through build_run_argv (shell-free; the RCE-fix pattern) — the
# authorization gate is orthogonal to, and on top of, that.

PENDING_AUTHORIZATION = "pending-authorization"
SEALED_EMIT = "scores-only"            # M5: only scores ever leave a sealed run
NODE_MEASUREMENT_ENV = "CHAMPOLLION_NODE_MEASUREMENT"


def item_requires_authorization(item: dict) -> bool:
    """True when a queue item targets a sealed/sovereign held-out set and so
    must NOT auto-run — it needs an explicit, current custodian grant first.

    Open (public, redistribution-cleared) items return False and are unaffected,
    exactly as today: a queue with no sealed items behaves identically.
    """
    return bool(item.get("sealed")) or bool(item.get("sealed_set_id"))


def _node_measurement(override: str | None = None) -> str:
    """The enclave / eval-node measurement bound into a request fingerprint.

    From the explicit override, else ``CHAMPOLLION_NODE_MEASUREMENT``, else the
    honest literal ``'unattested'`` — never a value that masquerades as an
    attested enclave when none was provided.
    """
    return override or os.environ.get(NODE_MEASUREMENT_ENV) or "unattested"


def compute_request_fingerprint(
    item: dict, *, node_measurement: str | None = None
) -> str:
    """SHA-256 hex of the request fingerprint for a sealed queue item.

    The recipe is the one stored by migration 038 and bound by a grant
    (migration 039): the newline-joined tuple ::

        method_sha \\n corpus_id \\n corpus_version \\n 'scores-only' \\n node_measurement

    Raises :class:`QueueItemError` if a sealed item is missing any fingerprint
    input, so a malformed sealed item is HELD pending (skipped) — never run.
    """
    method_sha = _require_str_field(item, "method_sha")
    corpus_id = _require_str_field(item, "corpus_id")
    corpus_version = _require_str_field(item, "corpus_version")
    node = (node_measurement if node_measurement is not None
            else _node_measurement())
    if not node:
        raise QueueItemError("missing node_measurement for sealed item")
    payload = "\n".join([method_sha, corpus_id, corpus_version, SEALED_EMIT, node])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _parse_ts(value) -> "datetime | None":
    """Parse an ISO-8601 timestamp (the ``auth_grants.expires_at`` shape) into
    an aware UTC datetime, or None if absent/unparseable (treated as invalid)."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str) or not value.strip():
        return None
    s = value.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def grant_is_valid(
    grant: dict, fingerprint: str, *, now: "datetime | None" = None
) -> bool:
    """A grant authorizes a sealed run iff it is UNUSED, UNEXPIRED, and
    FINGERPRINT-MATCHING — the three conditions migration 038's
    ``claim_auth_grant()`` asserts atomically at the DB. Pure (no I/O); the
    crypto/threshold layer that PRODUCES the grant is Wave 2.

    Fail-closed: a non-dict, a missing/unparseable expiry, or any mismatch
    returns False.
    """
    if not isinstance(grant, dict):
        return False
    if grant.get("used"):
        return False                                   # single-use
    if grant.get("fingerprint") != fingerprint:
        return False                                   # target-bound
    exp = _parse_ts(grant.get("expires_at"))
    if exp is None:
        return False                                   # no/!parseable expiry
    now = now or datetime.now(timezone.utc)
    return exp > now                                   # time-boxed


def select_valid_grant(
    grants, fingerprint: str, *, now: "datetime | None" = None
) -> "dict | None":
    """Return the first valid grant for ``fingerprint`` in ``grants``, else None."""
    for g in (grants or []):
        if grant_is_valid(g, fingerprint, now=now):
            return g
    return None


def _no_grants(fingerprint: str, item: dict) -> list:
    """Default grant source: NONE.

    Wave 1 ships with no client-side grant store, so a worker never auto-runs a
    sealed item (fail-closed). Wave 2 replaces this with a controlled-context
    lookup that reads ``auth_grants`` and consumes via ``claim_auth_grant``.
    """
    return []


def partition_authorization(
    items,
    *,
    grant_lookup=None,
    node_measurement: str | None = None,
    now: "datetime | None" = None,
) -> "tuple[list, list]":
    """Split selected queue items into ``(authorized, pending)``.

    Open (non-sealed) items are always authorized — unchanged behavior. A sealed
    item is authorized ONLY if a valid grant (unused / unexpired / fingerprint-
    matching) exists for its computed request fingerprint; otherwise it stays
    ``pending-authorization`` and is NOT run. A sealed item missing a fingerprint
    input is likewise held pending (never run), with an honest reason.

    ``grant_lookup`` is a ``(fingerprint, item) -> list[grant_dict]`` callable
    (dependency-injected for tests); it defaults to :func:`_no_grants`, the
    fail-closed Wave-1 source. ``pending`` is a list of ``(item, reason)``.
    """
    grant_lookup = grant_lookup or _no_grants
    node = (node_measurement if node_measurement is not None
            else _node_measurement())
    authorized: list = []
    pending: list = []
    for item in items:
        if not item_requires_authorization(item):
            authorized.append(item)
            continue
        try:
            fp = compute_request_fingerprint(item, node_measurement=node)
        except QueueItemError as exc:
            pending.append((item, f"sealed item not runnable: {exc}"))
            continue
        grant = select_valid_grant(grant_lookup(fp, item), fp, now=now)
        if grant is None:
            pending.append(
                (item, f"{PENDING_AUTHORIZATION}: no valid custodian grant"))
        else:
            # Record the binding so the run can present it when claiming the
            # grant at the DB (Wave 2). Does not change how the argv is built.
            item["_auth_grant_id"] = grant.get("grant_id")
            item["_auth_fingerprint"] = fp
            authorized.append(item)
    return authorized, pending


# ---------------------------------------------------------------------------
# Main execution loop
# ---------------------------------------------------------------------------

def run_from_args(args: argparse.Namespace) -> int:
    """Execute the queue command for parsed arguments. Returns exit code."""
    if args.top is not None and args.top <= 0:
        print("--top must be a positive integer", file=sys.stderr)
        return 2
    if args.budget is not None and args.budget <= 0:
        print("--budget must be a positive amount", file=sys.stderr)
        return 2
    if args.include_coached and not args.coaching_file:
        print("--include-coached requires --coaching-file", file=sys.stderr)
        return 2
    if args.coaching_file and not Path(args.coaching_file).is_file():
        print(f"coaching file not found: {args.coaching_file}",
              file=sys.stderr)
        return 2

    no_publish = getattr(args, "no_publish", False)

    # A gated/down queue host (HTML holding page, unreachable, …) must fail
    # with one actionable line, never a raw JSONDecodeError traceback.
    import urllib.error
    # Depth hint: a deterministic --top N run only ever consumes a shallow
    # ranked prefix, so the DB loader can stop paging early. Never bounded for
    # --budget (its selection legitimately scans arbitrarily deep for cheaper
    # items) or when the user explicitly forced --spread with --top (the
    # weighted permutation is defined over the full ranking).
    _bounded_top = (
        args.top
        if (args.top is not None and args.budget is None
            and getattr(args, "spread", None) is not True)
        else None
    )
    try:
        queue = load_queue(args.queue, top=_bounded_top,
                           include_coached=args.include_coached)
    except QueueUnavailableError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except urllib.error.URLError as exc:
        reason = getattr(exc, "reason", exc)
        print(f"Could not fetch the queue from {args.queue}: {reason} — "
              f"check your connection, or pass --queue <url-or-file>.",
              file=sys.stderr)
        return 1
    except FileNotFoundError:
        print(f"Queue file not found: {args.queue}", file=sys.stderr)
        return 1
    outage = queue_health_error(queue, args.queue)
    if outage:
        print(outage, file=sys.stderr)
        return 1
    if (queue.get("metadata") or {}).get("_degraded_from_db"):
        print("  \u26a0 Live queue database unreachable "
              f"({queue['metadata']['_degraded_from_db']}) — running from the "
              f"static fallback at {DEFAULT_QUEUE_URL}. Its ranking and its "
              "verified-coverage filtering may be stale.", file=sys.stderr)
    # Coverage skip: drop combos already completed on the leaderboard so donated
    # compute proceeds through the lineup instead of re-running covered work.
    # The spread (below) handles intra-batch diversity; this handles combos
    # already published (by you on a prior run, or another worker). Best-effort —
    # on any fetch failure the full queue runs. Pairs with the nightly queue
    # regen, which refreshes the priority ranking.
    _covered = _fetch_published_combos()
    if _covered:
        _items = queue.get("items", [])
        queue["items"] = _drop_covered(_items, _covered)
        _dropped = len(_items) - len(queue["items"])
        if _dropped:
            print(f"  Coverage skip: {_dropped} combo(s) already on the leaderboard — running the rest.")
    # Anti-collision: spread defaults ON for the --budget donate flow (many
    # contributors run simultaneously and don't care which items they get) and
    # OFF for an explicit --top (the user asked for the best N specifically).
    spread = getattr(args, "spread", None)
    if spread is None:
        spread = args.budget is not None
    spread_seed = getattr(args, "spread_seed", None)
    rng = random.Random(spread_seed) if spread else None
    selected, skipped = select_items(
        queue,
        top=args.top,
        budget=args.budget,
        include_coached=args.include_coached,
        spread=spread,
        rng=rng,
    )
    if not selected:
        print("No runnable items matched the selection.")
        for item_id, reason in skipped[:10]:
            print(f"  skipped {item_id}: {reason}")
        return 1

    # Sealed-set gating (the sovereign multisig plan, M2). A sovereign held-out item must
    # NOT auto-run on pickup — it stays pending-authorization until a valid
    # custodian grant exists for THIS exact request (unused / unexpired /
    # fingerprint-matching). The Wave-1 default lookup is fail-closed (no
    # grants), so sealed items are simply held and logged honestly, never run.
    selected, pending_auth = partition_authorization(selected)
    if pending_auth:
        print(f"\n  ⏸ {len(pending_auth)} sealed item(s) held in "
              f"{PENDING_AUTHORIZATION} — not run "
              f"(await M-of-N custodian approval):")
        for item, reason in pending_auth:
            pair = item.get("language_pair") or item.get("id", "?")
            print(f"      {pair}: {reason}")
    if not selected:
        print("\nNo runnable items after sealed-set gating "
              "(all held pending-authorization).")
        return 1

    est_known = [i["est_cost_usd"] for i in selected
                 if i.get("est_cost_usd") is not None]
    total_est = sum(est_known)
    model_line = (queue.get("metadata", {})
                  .get("priority_model", ""))[:60]
    print(f"Plan: {len(selected)} item(s) from the top of the queue "
          f"({model_line}…)")
    for i, item in enumerate(selected, 1):
        est = item.get("est_cost_usd")
        est_str = f"${est:.4f}" if est is not None else "cost unknown"
        print(f"  {i:>2}. {item['language_pair']:<10} {item['model']:<36} "
              f"{item['condition']:<8} {est_str}"
              f"{transmission_plan_marker(item)}")
    n_restricted = sum(1 for it in selected if transmission_plan_marker(it))
    if n_restricted:
        from mt_eval_harness.transmission_policy import (
            OPENROUTER_RESTRICTED_PROVIDER_PREFS,
        )
        print(f"  {n_restricted} marked item(s) use license-restricted "
              "corpora: transmitted only over no-train channels — mt-eval "
              "pins OpenRouter requests to provider "
              f"{json.dumps(OPENROUTER_RESTRICTED_PROVIDER_PREFS)} "
              "automatically; first-party APIs and local runs qualify.")
    unknown = len(selected) - len(est_known)
    print(f"Estimated spend: ${total_est:.4f}"
          + (f" + {unknown} item(s) with unknown cost" if unknown else ""))
    print("Estimates come from the queue's est_basis fields; actual cost "
          "depends on provider pricing at run time.")
    if args.budget is not None:
        print(f"Budget cap: ${args.budget:.2f} — the runner will stop early "
              "if actual costs exceed estimates.")
    if len(selected) > 20:
        print(f"\n  ⚠ Large batch: this will run {len(selected)} benchmarks "
              f"and make many API calls.")
        print("    It can take a while. Cap it with --top N (e.g. --top 10) "
              "or a smaller --budget;")
        print("    Ctrl+C stops safely and keeps everything already published.")
    if not no_publish:
        print("Results will be auto-published after each run.")

    if args.dry_run:
        print("\n--dry-run: nothing executed.")
        return 0

    # --- Step 1: Publishing identity (before spending tokens) ---
    # The three-way door (founder directive 2026-07-13: OAuth optional, not
    # required): sign in (attributed) / continue anonymously / --no-publish.
    # A signed-in session is cached to ~/.mt-eval/auth.json, so subsequent
    # publish_to_supabase calls reuse it without re-prompting.
    submitter = None
    anonymous = getattr(args, "anonymous", False)
    if not no_publish:
        print("\n" + "=" * 60)
        print("Step 1: Publishing identity (no account needed)")
        print("=" * 60)
        door = _publishing_door(args)
        if door is None:
            print("\n  No publishing path chosen — nothing was spent.",
                  file=sys.stderr)
            print("  Re-run with --anonymous to publish without an account, "
                  "or --no-publish to keep results local.", file=sys.stderr)
            return 1
        submitter, anonymous = door

    # --- Step 2: Resolve provider and verify API key ---
    print(f"\n{'=' * 60}")
    print("Step 2: API key")
    print("=" * 60)
    provider_explicit = getattr(args, "provider", None) is not None
    provider_name = getattr(args, "provider", None)
    if not provider_name:
        provider_name = detect_provider()
    if not provider_name:
        available = ", ".join(PROVIDER_KEY_MAP.values())
        print(f"\nNo API key found. Set one of: {available}",
              file=sys.stderr)
        print("  Or pass --provider explicitly.", file=sys.stderr)
        return 1
    try:
        from mt_eval_harness.providers import get_provider
        provider = get_provider(provider_name)
        provider.load_api_key()
        env_var = PROVIDER_KEY_MAP[provider_name]
        print(f"  ✓ {env_var} found (provider: {provider_name})")
        notice = _direct_key_notice(provider_explicit, provider_name)
        if notice:
            print(f"  ℹ {notice}")
    except Exception:
        env_var = PROVIDER_KEY_MAP.get(provider_name, "API_KEY")
        print(f"\n{env_var} not found (environment or .env/"
              ".env.local) — refusing to start.", file=sys.stderr)
        return 1

    # --- Step 3: Confirm spend ---
    if not args.yes:
        try:
            answer = input("\nProceed and spend your tokens? [y/N]: ")
        except (EOFError, KeyboardInterrupt):
            print("\nCancelled.")
            return 1
        if answer.strip().lower() not in ("y", "yes"):
            print("Cancelled.")
            return 1
    else:
        # --yes skips the interactive prompt — but a cached-session / unattended
        # run must NEVER spend (and publish to a public leaderboard) silently.
        # Echo exactly what is about to happen: the spend cap, the attributed
        # identity, and whether results publish. This is what reconciles the
        # curl|bash banner's "confirmation at each step" promise with the
        # reality of --yes + a cached OAuth session.
        cap = (f"up to ${args.budget:.2f}" if args.budget is not None
               else f"the top {args.top} item(s)")
        if no_publish:
            print(f"\n  --yes: spending {cap} — NOT publishing (--no-publish).")
        else:
            who = submitter or "'anonymous' (no account — not attributed)"
            print(f"\n  --yes: spending {cap}, publishing each result to the "
                  f"public leaderboard as {who}.")

    # --- Step 4: Execute items ---
    #
    # Concurrency strategy:
    #   - ≤3 items: sequential (jobs=1) for immediate per-item feedback,
    #     matching the typical --budget 2 scenario. The user sees each
    #     run start and finish before the next begins.
    #   - >3 items: concurrent (default 8) for throughput.
    #   - --jobs always overrides when explicitly set.
    #
    # Safety:
    #   - Per-item timeout (default 300s) kills hung subprocesses.
    #   - Ctrl+C sets auth_abort; in-flight runs finish (tokens already
    #     spent), but no new items start. Second Ctrl+C force-kills.
    #   - Budget guard checks BEFORE dispatching each new item, not
    #     just after completions — prevents over-spending in concurrent
    #     mode.
    #   - 3 consecutive failures offer key re-entry instead of silently
    #     stopping.

    jobs_explicit = getattr(args, "jobs", None) is not None
    # Default concurrency. Direct providers (anthropic/openai/gemini) have far
    # tighter rate limits than OpenRouter's pooled proxy, so a large `give`
    # batch hammered at 8× would 429-storm. Be gentler when off OpenRouter.
    default_jobs = 8 if provider_name == "openrouter" else 4
    jobs = getattr(args, "jobs", None) or default_jobs
    item_timeout = getattr(args, "timeout", 300) or 300
    stop_on_failure = getattr(args, "stop_on_failure", False)

    # Sequential-first for small batches
    if len(selected) <= 3 and not jobs_explicit:
        jobs = 1

    mode_label = "sequential" if jobs == 1 else f"{jobs} concurrent"
    print(f"\n{'=' * 60}")
    print(f"Running {len(selected)} benchmark{'s' if len(selected) != 1 else ''}"
          f" ({mode_label})")
    print("=" * 60)
    print(f"  Per-item timeout: {item_timeout}s")
    if no_publish:
        print("  Press Ctrl+C to stop safely — completed runs stay in your "
              "local reports (--no-publish).")
    else:
        print("  Press Ctrl+C to stop safely — completed runs are already "
              "published.")
    print()

    # Pre-build the argv for each item.
    #
    # SECURITY: we reconstruct a shell-free argv from the item's STRUCTURED
    # fields (build_run_argv) and NEVER execute the item's network-supplied
    # run_command string in a shell. An item that can't be safely rebuilt is
    # marked unbuildable here and reported as a failure at dispatch — it is
    # never shelled as a fallback.
    #
    # Each item also gets its OWN report output dir (--output-dir) so the
    # runner reads back exactly that item's report — never a concurrent
    # sibling's. Without isolation, discovery falls back to "newest
    # *_report.json in the shared dir", which cross-matches under concurrency
    # (the default for >3 items) — mis-attributing cost/score and, worse,
    # leaving some results unpublished while others publish twice. Reports land
    # under eval/logs/harness/queue/ so they survive for manual `mt-eval
    # publish`.
    for index, item in enumerate(selected, 1):
        safe_id = re.sub(r"[^A-Za-z0-9._-]", "_",
                         str(item.get("id", f"item{index}")))
        report_dir = (Path(DEFAULT_OUTPUT_DIR) / "queue"
                      / f"{index:03d}_{safe_id}")
        try:
            item["_argv"] = build_run_argv(
                item,
                coaching_file=args.coaching_file,
                provider=provider_name,
                output_dir=str(report_dir),
            )
            item["_report_dir"] = str(report_dir)
        except QueueItemError as exc:
            item["_argv"] = None
            item["_report_dir"] = None
            item["_build_error"] = f"unrunnable queue item: {exc}"

    from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED

    # Shared state — protected by a lock for the few mutable counters.
    _reset_publish_gate()   # a fresh batch starts with an open publish window
    lock = threading.Lock()
    completed = []          # [(item, report_path, actual_cost, chrf, outcome)]
    failed_items = []       # [(item, error_hint)]
    timed_out_items = []    # [(item, timeout_seconds)]
    skipped_covered_items = []  # [item] — already on the board (another worker)
    done_count = 0
    total_items = len(selected)
    actual_spend = 0.0
    budget = args.budget

    # auth_abort: set on signal, consecutive failures, budget exceeded,
    # or --stop-on-failure. Workers check before starting a subprocess.
    auth_abort = threading.Event()

    # Track running Popen objects so a second Ctrl+C can force-kill them.
    running_procs: set[subprocess.Popen] = set()
    proc_lock = threading.Lock()

    # --- Signal handling: graceful two-stage Ctrl+C ---
    interrupt_count = [0]
    original_sigint = signal.getsignal(signal.SIGINT)

    def _handle_sigint(signum, frame):
        interrupt_count[0] += 1
        if interrupt_count[0] == 1:
            print("\n")
            print("  Stopping gracefully — waiting for in-flight runs "
                  "to finish...")
            print("  (Completed runs are already published. "
                  "Press Ctrl+C again to force-kill.)")
            auth_abort.set()
        else:
            print("\n  Force-killing all running processes...")
            with proc_lock:
                for proc in list(running_procs):
                    try:
                        proc.kill()
                    except OSError:
                        pass
            signal.signal(signal.SIGINT, original_sigint)
            raise KeyboardInterrupt

    signal.signal(signal.SIGINT, _handle_sigint)

    def _run_one(item: dict, index: int) -> dict:
        """Run a single queue item in a thread. Returns a result dict.

        Uses Popen + communicate(timeout=) so hung API calls are killed
        after item_timeout seconds instead of blocking the thread forever.
        """
        nonlocal done_count

        if auth_abort.is_set():
            return {"item": item, "status": "skipped", "index": index}

        # Per-item coverage recheck (concurrency safety). The batch already
        # dropped combos covered at selection time, but this batch may have
        # been running for minutes — another contributor could have published
        # THIS exact (corpus, model, condition) since. Re-check immediately
        # before spending so two simultaneous contributors don't redo the same
        # item. Best-effort + fail-open: an unreachable board never blocks a run.
        if _combo_published(item.get("corpus_id"), item.get("model"),
                            item.get("condition")):
            with lock:
                done_count += 1
            return {"item": item, "status": "skipped_covered", "index": index}

        argv = item.get("_argv")
        if not argv:
            # Could not safely reconstruct the command from the item's
            # structured fields. We NEVER fall back to shelling the
            # network-supplied run_command — report it as a failure instead.
            with lock:
                done_count += 1
            return {
                "item": item, "status": "failed",
                "error": item.get("_build_error",
                                  "could not build run command"),
                "output": "", "index": index,
            }

        # Start the subprocess and track it for force-kill.
        #
        # SECURITY: argv is a list and shell is NOT used (no shell=True) — the
        # untrusted queue string is never interpreted by a shell.
        #
        # stdin=DEVNULL is critical: the runner owns ALL terminal I/O. Each
        # `mt-eval run` child otherwise inherits our tty (the give flow runs
        # `mt-eval queue ... < /dev/tty`) and blocks forever on its own
        # end-of-run "Publish this run? [y/N]" prompt — whose text is hidden
        # inside our captured stdout pipe — until the per-item timeout kills
        # it. With DEVNULL the child sees a non-interactive stdin and skips
        # that prompt; the runner publishes instead.
        proc = subprocess.Popen(
            argv,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True,
        )
        with proc_lock:
            running_procs.add(proc)

        try:
            stdout, _ = proc.communicate(timeout=item_timeout)
        except subprocess.TimeoutExpired:
            proc.kill()
            stdout, _ = proc.communicate()
            with proc_lock:
                running_procs.discard(proc)
            with lock:
                done_count += 1
            return {
                "item": item, "status": "timeout",
                "output": stdout or "",
                "index": index,
                "timeout_seconds": item_timeout,
            }

        with proc_lock:
            running_procs.discard(proc)

        # Read this item's report from its OWN isolated output dir, so a
        # concurrent sibling's report can never be mistaken for ours.
        report_dir = item.get("_report_dir")
        if report_dir:
            report_path = _find_report_in_dir(report_dir)
        else:
            report_path = _find_latest_report(item)
        item_cost = 0.0
        item_chrf = None
        if report_path:
            item_cost = _read_report_cost(report_path)
            item_chrf = _read_report_chrf(report_path)

        with lock:
            done_count += 1

        if proc.returncode != 0:
            error_hint = _extract_error_hint(stdout or "")
            return {
                "item": item, "status": "failed",
                "error": error_hint, "output": stdout or "",
                "index": index,
            }

        return {
            "item": item, "status": "ok",
            "report_path": report_path,
            "cost": item_cost, "chrf": item_chrf,
            "index": index,
        }

    # --- Execution loop: incremental dispatch + heartbeat ---
    #
    # Items are submitted one-at-a-time (up to `jobs` concurrent).
    # Before each new submission the budget guard checks whether the
    # next item's estimated cost still fits. A 15-second heartbeat
    # reassures the user that work is happening during long runs.

    consecutive_failures = 0
    consecutive_auth_failures = 0   # only real 401/403/invalid-key failures
    transient_notice_shown = False  # show the rate-limit hint at most once
    pending = list(enumerate(selected, 1))  # [(1-based index, item)]
    active_futures: dict = {}               # {future: (index, item)}
    start_time = time.time()

    try:
        with ThreadPoolExecutor(max_workers=jobs) as pool:
            while pending or active_futures:
                # Fill slots up to `jobs`, checking budget before each
                while pending and len(active_futures) < jobs:
                    if auth_abort.is_set():
                        break
                    idx, item = pending[0]
                    # Pre-dispatch budget guard
                    if budget is not None:
                        est = item.get("est_cost_usd", 0) or 0
                        if actual_spend + est > budget:
                            pending.pop(0)
                            pair = item.get("language_pair", "???")
                            print(f"  ⊘ {pair:<10} skipped "
                                  f"(${est:.4f} would exceed remaining "
                                  f"budget)")
                            continue
                    pending.pop(0)
                    future = pool.submit(_run_one, item, idx)
                    active_futures[future] = (idx, item)

                if not active_futures:
                    break

                # Wait for the next completion OR a 15-second heartbeat
                done_set, _ = wait(
                    active_futures,
                    return_when=FIRST_COMPLETED,
                    timeout=15,
                )

                if not done_set:
                    # Heartbeat: reassure the user something is happening
                    elapsed = int(time.time() - start_time)
                    with lock:
                        current = done_count
                    in_flight = len(active_futures)
                    print(f"  ⏳ {elapsed}s elapsed — {in_flight} in flight, "
                          f"{current}/{total_items} done...")
                    continue

                for future in done_set:
                    idx, item = active_futures.pop(future)
                    try:
                        result = future.result()
                    except Exception as exc:
                        # Defensive: _run_one catches internally, but
                        # guard against unexpected threading errors.
                        result = {
                            "item": item, "status": "failed",
                            "error": str(exc), "index": idx,
                        }

                    pair = item.get("language_pair", "???")

                    if result["status"] == "skipped":
                        continue

                    if result["status"] == "skipped_covered":
                        # Another contributor published this exact combo while
                        # our batch ran — skipped before spending a token.
                        with lock:
                            current = done_count
                        print(f"  ⊙ {current}/{total_items}  "
                              f"{pair:<10} already on the leaderboard — "
                              f"skipped (no spend).")
                        skipped_covered_items.append(item)
                        continue

                    # Progress bar
                    with lock:
                        current = done_count
                    pct = current / total_items
                    bar_w = 25
                    filled = int(bar_w * pct)
                    bar = "█" * filled + "░" * (bar_w - filled)

                    if result["status"] == "ok":
                        consecutive_failures = 0
                        consecutive_auth_failures = 0
                        cost = result["cost"]
                        chrf = result["chrf"]
                        actual_spend += cost
                        chrf_str = (f"chrF++ {chrf:.1f}"
                                    if chrf is not None else "—")
                        cost_str = f"${cost:.4f}" if cost > 0 else "—"
                        print(f"  {bar} {current}/{total_items}  "
                              f"✓ {pair:<10} {chrf_str:<14} {cost_str}")

                        # Auto-publish via _auto_publish, which can never
                        # raise (it swallows SystemExit too) — so one bad
                        # publish cannot abort the rest of the batch. Track
                        # the real outcome so the summary reports honestly.
                        rpath = result.get("report_path")
                        if no_publish:
                            outcome = PublishOutcome(ok=False)
                        elif rpath:
                            outcome = _auto_publish(str(rpath), pair,
                                                    anonymous=anonymous)
                        else:
                            print(f"    ⚠ {pair}: run finished but no report "
                                  f"was found — cannot publish.")
                            outcome = PublishOutcome(ok=False)

                        completed.append((item, rpath, cost, chrf, outcome))

                    elif result["status"] == "timeout":
                        consecutive_failures += 1
                        consecutive_auth_failures = 0  # a timeout is not auth
                        t = result.get("timeout_seconds", item_timeout)
                        print(f"  {bar} {current}/{total_items}  "
                              f"⏱ {pair:<10} timed out after {t}s")
                        timed_out_items.append((item, t))

                    elif result["status"] == "failed":
                        consecutive_failures += 1
                        error_hint = result.get("error", "")
                        # Vendor-key failures on engine items never count
                        # toward the LLM-lane breaker (see
                        # counts_toward_llm_auth_abort); engine failures still
                        # count toward the transient-failure notice.
                        if item.get("condition") == "engine":
                            pass
                        elif counts_toward_llm_auth_abort(item, error_hint):
                            consecutive_auth_failures += 1
                        else:
                            consecutive_auth_failures = 0
                        print(f"  {bar} {current}/{total_items}  "
                              f"✗ {pair:<10} {error_hint[:80]}")
                        failed_items.append((item, error_hint))

                    # --stop-on-failure: halt on any failure or timeout
                    if (stop_on_failure
                            and result["status"] in
                            ("failed", "timeout")):
                        auth_abort.set()
                        print(f"\n  --stop-on-failure: halting "
                              f"after {pair}.")
                        for f in active_futures:
                            f.cancel()
                        break

                    # Circuit breaker. Distinguish a genuine auth/key problem
                    # (offer key re-entry) from a transient rate-limit/timeout
                    # storm (back off and keep going). Never stall the batch on
                    # a misleading "bad key" prompt the contributor may not be
                    # around to answer.
                    if (consecutive_auth_failures >= 3
                            and not auth_abort.is_set()):
                        ev = PROVIDER_KEY_MAP.get(
                            provider_name, "API_KEY"
                        )
                        print(
                            f"\n  {consecutive_auth_failures} consecutive auth "
                            f"failures (401/403) — your {ev} looks invalid or "
                            f"unauthorized."
                        )
                        new_key = _prompt_reenter_key(ev)
                        if new_key:
                            os.environ[ev] = new_key
                            consecutive_failures = 0
                            consecutive_auth_failures = 0
                            print("  ✓ Key updated — resuming.")
                        else:
                            auth_abort.set()
                            print("  Stopping remaining items.")
                            for f in active_futures:
                                f.cancel()
                            break
                    elif (consecutive_failures >= 5
                            and not transient_notice_shown
                            and not auth_abort.is_set()):
                        # Transient failures (rate limits / timeouts / provider
                        # blips), not an auth problem. Inform once and keep
                        # going — completed runs are already published, so we
                        # never throw progress away by stalling for input.
                        transient_notice_shown = True
                        print(
                            "\n  ⚠ Several failures in a row (rate limits, "
                            "timeouts, or provider errors) — not an auth "
                            "problem."
                        )
                        print(
                            "    Completed runs are already published. "
                            "Continuing — if this keeps up, re-run later or "
                            "with --jobs 2 / --timeout 600."
                        )

                    # Post-completion budget guard
                    if (budget is not None
                            and actual_spend > budget):
                        print(
                            f"\n  Budget guard: ${actual_spend:.4f} "
                            f"spent, exceeding ${budget:.2f} budget."
                        )
                        auth_abort.set()
                        for f in active_futures:
                            f.cancel()
                        break

    except KeyboardInterrupt:
        # Second Ctrl+C — signal handler already killed subprocesses
        pass
    finally:
        signal.signal(signal.SIGINT, original_sigint)

    # --- Step 5: Summary ---
    failures = len(failed_items)
    timeouts = len(timed_out_items)
    succeeded = len(completed)
    total_run = succeeded + failures + timeouts
    print(f"\n{'=' * 60}")

    if completed:
        published_count = sum(1 for *_rest, o in completed if o.ok)
        publish_failed = [
            (item, rpath, o)
            for item, rpath, _cost, _chrf, o in completed
            if not no_publish and not o.ok
        ]

        # Mesh highlight: only the pairs we actually published.
        pairs_lit = []
        for item, _rpath, _cost, _chrf, o in completed:
            if not no_publish and not o.ok:
                continue
            pair = item.get("language_pair", "")
            if pair and pair not in pairs_lit:
                pairs_lit.append(pair)

        print(f"  🎉 You contributed {succeeded} "
              f"run{'s' if succeeded != 1 else ''} "
              f"to the translation mesh!")
        if not no_publish:
            print(f"     {published_count}/{succeeded} published to the "
                  f"leaderboard.")
        print()
        for item, rpath, cost, chrf, o in completed:
            pair = item.get("language_pair", "???")
            chrf_str = (f"chrF++ {chrf:.1f}"
                        if chrf is not None else "—")
            if no_publish:
                status = "local only"
            elif o.ok:
                status = "published"
            elif o.rate_limited:
                status = "deferred — rate limit"
            else:
                status = "NOT published"
            print(f"    {pair:<10} {chrf_str:<14} "
                  f"${cost:.4f}  ({status})")

        print(f"\n  Total cost: ${actual_spend:.4f}"
              + (f"  (budget: ${budget:.2f})" if budget else ""))

        if publish_failed:
            # ONE summary block with ONE re-publish command — never a
            # scattered per-item hint for each unpublished result.
            deferred_n = sum(
                1 for *_x, o in publish_failed if o.rate_limited)
            failed_n = len(publish_failed) - deferred_n
            for line in _render_unpublished_block(
                    deferred_n, failed_n, anonymous=anonymous):
                print(line)

        if not no_publish and pairs_lit:
            print(f"\n  See your edges on the map: https://champollion.dev/")
            print("  New edges appear when the mesh next regenerates.")
    else:
        print(f"  No runs completed successfully "
              f"({failures} failed, {timeouts} timed out).")

    if skipped_covered_items:
        print(f"\n  ⊙ {len(skipped_covered_items)} item(s) were already on "
              f"the leaderboard (another contributor got there first) and "
              f"were skipped — no tokens spent on a redo.")

    if timeouts:
        print(f"\n  ⏱ {timeouts} item(s) timed out "
              f"(>{item_timeout}s). Try --timeout N to adjust.")

    if failures:
        print(f"\n  ⚠ {failures}/{total_run} item(s) failed.")

    if interrupt_count[0] > 0:
        print(f"\n  Stopped by user signal — {len(pending)} "
              f"item(s) were not started.")

    print("=" * 60)

    return 0 if failures == 0 and timeouts == 0 else 1

