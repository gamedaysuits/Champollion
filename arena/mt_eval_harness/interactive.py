"""
Guided, low-friction dataset selection for ``mt-eval run``.

When a human runs ``mt-eval run`` with no corpus and a real terminal, this
module walks them end-to-end:

    source language → target language → pick a corpus (with size, contamination
    risk, domain, license, gated?, provider) → contamination self-attestation
    (REQUIRED) → if gated, the EXACT accept-terms URL + token-export
    instructions → confirm → (the caller fetches-from-source and runs).

The interactive layer is OPTIONAL: if ``questionary`` is installed we use its
nicer prompts; otherwise we fall back to plain ``input()`` — so the harness
stays pip-installable and cold-working with ZERO extra dependencies. The
guided flow is NEVER entered in a non-TTY / CI / piped context (the caller
gates on that), so an agent or a script can never hang waiting for input.

The contamination attestation built here is recorded on the run (see
``make_attestation``) so it can surface in the trust UI later.
"""

from __future__ import annotations

import difflib
import sys
from datetime import datetime, timezone
from typing import Any

from mt_eval_harness import corpora_browse

ATTESTATION_STATEMENT = (
    "I attest that the method/model under evaluation was NOT trained on this "
    "corpus (no contamination)."
)


# ---------------------------------------------------------------------------
# Attestation record — the single builder, shared by guided + flag paths
# ---------------------------------------------------------------------------

def make_attestation(
    corpus: str | None, *, attested: bool, via: str,
) -> dict[str, Any] | None:
    """Build the contamination-attestation record, or None if not attested.

    Recorded on the run (RunConfig.contamination_attestation → run log
    provenance) so the trust UI can later show that the submitter affirmed
    their method was not trained on the corpus.
    """
    if not attested:
        return None
    return {
        "attested": True,
        "kind": "no-training-contamination",
        "statement": ATTESTATION_STATEMENT,
        "corpus": corpus,
        "via": via,  # "guided" | "flag"
        "attested_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Prompt helpers — questionary if available, else input()
# ---------------------------------------------------------------------------

def _questionary():
    try:
        import questionary  # noqa: PLC0415
    except Exception:
        return None
    return questionary


class _Aborted(Exception):
    """Raised when the user cancels (Ctrl-C / EOF / explicit abort)."""


def prompt_text(message: str, default: str | None = None) -> str:
    q = _questionary()
    try:
        if q is not None:
            ans = q.text(message, default=default or "").ask()
            if ans is None:
                raise _Aborted()
            return ans.strip()
        suffix = f" [{default}]" if default else ""
        ans = input(f"  {message}{suffix}: ").strip()
        return ans or (default or "")
    except (EOFError, KeyboardInterrupt):
        raise _Aborted()


def prompt_confirm(message: str, default: bool = False) -> bool:
    q = _questionary()
    try:
        if q is not None:
            ans = q.confirm(message, default=default).ask()
            if ans is None:
                raise _Aborted()
            return bool(ans)
        d = "Y/n" if default else "y/N"
        ans = input(f"  {message} [{d}]: ").strip().lower()
        if not ans:
            return default
        return ans in ("y", "yes")
    except (EOFError, KeyboardInterrupt):
        raise _Aborted()


def prompt_choice(message: str, choices: list[tuple[str, Any]]) -> Any:
    """Single-select from (label, value) pairs. Returns the chosen value."""
    q = _questionary()
    try:
        if q is not None:
            chosen = q.select(
                message,
                choices=[q.Choice(title=label, value=val) for label, val in choices],
            ).ask()
            if chosen is None:
                raise _Aborted()
            return chosen
        # input() fallback: numbered menu.
        print(f"  {message}")
        for i, (label, _val) in enumerate(choices, 1):
            print(f"    {i}. {label}")
        while True:
            raw = input(f"  Enter 1-{len(choices)}: ").strip()
            if raw.isdigit() and 1 <= int(raw) <= len(choices):
                return choices[int(raw) - 1][1]
            print("    Please enter a valid number.")
    except (EOFError, KeyboardInterrupt):
        raise _Aborted()


# ---------------------------------------------------------------------------
# Language-code prompting (free text + validation + suggestions)
# ---------------------------------------------------------------------------

def _prompt_lang_code(message: str, valid: list[str]) -> str:
    """Prompt for an ISO code constrained to ``valid``, with suggestions."""
    valid_set = set(valid)
    while True:
        code = prompt_text(message).strip()
        if not code:
            print("    A language code is required.")
            continue
        if code in valid_set:
            return code
        close = difflib.get_close_matches(code, valid, n=6, cutoff=0.3)
        if close:
            print(f"    '{code}' has no runnable corpora. Did you mean: "
                  f"{', '.join(close)}?")
        else:
            sample = ", ".join(valid[:12])
            print(f"    '{code}' not found. Some available codes: {sample} …")


# ---------------------------------------------------------------------------
# The guided flow
# ---------------------------------------------------------------------------

def run_guided(args) -> bool:
    """Drive the guided selection, mutating ``args`` in place.

    On success: sets ``args.corpus`` to the chosen registry id, records the
    attestation on ``args`` (``_attestation``), and marks gated acknowledgement
    so the downstream fetch proceeds. Returns True to continue to the run.

    Returns False when the user aborts (the caller should exit cleanly).
    """
    print("\n  ── Guided run ──")
    print("  No corpus given — let's pick one. (Press Ctrl-C to cancel.)\n")
    try:
        return _guided_flow(args)
    except _Aborted:
        print("\n  Cancelled. Nothing was run.")
        return False


def _guided_flow(args) -> bool:
    sources = corpora_browse.available_source_langs()
    if not sources:
        print("  No runnable corpora are registered. Check your registry "
              "(python arena/scripts/build_registry.py).")
        return False

    source = _prompt_lang_code(
        "Source language (ISO 639-3 code, e.g. 'eng')", sources,
    )
    targets = corpora_browse.available_targets_for_source(source)
    target = _prompt_lang_code(
        f"Target language for {corpora_browse.lang_name(source)} "
        f"(ISO 639-3 code, e.g. 'tel')",
        targets,
    )

    infos = corpora_browse.list_corpora_for_pair(source, target)
    if not infos:
        print(f"\n  No corpora for {source}→{target}. Re-run to try again.")
        return False

    # Show the detailed table, then offer a pick-list.
    print(corpora_browse.format_corpora_table(infos, source, target))
    choices = []
    for info in infos:
        contam = info.get("contamination") or "?"
        gated = " [GATED]" if info.get("gated") else ""
        choices.append((
            f"{info['id']}  ({info.get('size', '?')} sentences, "
            f"contamination {contam}, {info.get('domain', '?')}, "
            f"{info.get('license', '?')}){gated}",
            info,
        ))
    selected = prompt_choice("Select a corpus to evaluate against:", choices)

    # --- Contamination self-attestation (REQUIRED) ---
    print(
        f"\n  Contamination check for '{selected['id']}'"
        f" (risk: {selected.get('contamination') or 'unknown'}).\n"
        f"  {ATTESTATION_STATEMENT}"
    )
    if not prompt_confirm(
        "Do you confirm your method/model was NOT trained on this corpus?",
        default=False,
    ):
        print(
            "\n  Attestation declined — not running. A contamination "
            "attestation is required to evaluate against this corpus, so "
            "results stay trustworthy."
        )
        return False

    # --- Non-commercial terms acknowledgment (REQUIRED for NC corpora) ---
    # An NC dataset (CC-BY-NC / -NC-SA) is usable for non-commercial / research
    # evaluation, but the submitter must acknowledge its terms first. This is the
    # SAME attestation step extended — not a duplicate flow.
    nc_ack = None
    sel_license = selected.get("license")
    if _license_is_non_commercial(sel_license):
        from mt_eval_harness.license_use import (
            NC_TERMS_STATEMENT, make_nc_acknowledgment,
        )
        print(
            f"\n  '{selected['id']}' is NON-COMMERCIAL / research-only "
            f"(license: {sel_license}).\n  {NC_TERMS_STATEMENT}"
        )
        if not prompt_confirm(
            "Do you acknowledge these non-commercial terms?", default=False,
        ):
            print(
                "\n  Acknowledgment declined — not running. This corpus is "
                "licensed for non-commercial use only; an acknowledgment is "
                "required to evaluate against it."
            )
            return False
        nc_ack = make_nc_acknowledgment(
            selected["id"], sel_license, via="guided")

    # --- Gated handling ---
    if selected.get("gated"):
        if not _handle_gated(selected):
            return False

    # --- Wire the selection back onto args ---
    args.corpus = selected["id"]
    # Carry the ISO codes so the MT-system adapters / run card can use them.
    if not getattr(args, "source_code", None):
        args.source_code = source
    if not getattr(args, "target_code", None):
        args.target_code = target
    # Carry the human-readable language NAMES the LLM prompt needs. The pair is
    # chosen by ISO code, but the prompt ("Translate … to French") wants a
    # name — without this, a guided LLM run reached the harness with an empty
    # target_lang. Resolve offline via the language cards; fall back to the
    # code. (corpus_loader resolves the same way from the corpus, but wiring it
    # here makes the guided path explicit and independent of corpus metadata.)
    from mt_eval_harness.language_cards import get_name
    if not getattr(args, "source_lang", ""):
        args.source_lang = get_name(source) or source
    if not getattr(args, "target_lang", ""):
        args.target_lang = get_name(target) or target
    args.attest_no_training = True
    args._attest_via = "guided"
    args.accept_terms = True if selected.get("gated") else getattr(
        args, "accept_terms", False)
    # Mark NC terms acknowledged so the downstream run-time gate is satisfied.
    if nc_ack is not None:
        args.accept_nc_terms = True
        args._nc_acknowledgment = nc_ack
    # The attestation record (also rebuilt in cli for the flag path).
    args._attestation = make_attestation(
        selected["id"], attested=True, via="guided")

    print(f"\n  ✓ Selected '{selected['id']}'. Fetching from source and "
          f"running…\n")
    return True


def _handle_gated(info: dict[str, Any]) -> bool:
    """Show exact accept-terms + token instructions for a gated corpus.

    Returns True to proceed (token present, or user chose to proceed anyway),
    False to abort.
    """
    terms_url = info.get("terms_url") or "(the dataset page)"
    token_env = info.get("token_env") or "HF_TOKEN"
    print(
        f"\n  '{info['id']}' is a GATED dataset. Two one-time steps are "
        f"needed:\n"
        f"    1. Accept the terms: open\n         {terms_url}\n"
        f"       and click 'Agree and access repository'.\n"
        f"    2. Provide an access token:\n"
        f"         export {token_env}=hf_xxxxxxxx     "
        f"(or run `huggingface-cli login`)\n"
    )
    token = _resolve_token(token_env)
    if token:
        print(f"  ✓ A token was found in your environment ({token_env}). If "
              f"you've accepted the terms, the fetch will succeed.\n")
        return True

    print(f"  ⚠ No {token_env} found in your environment yet.")
    return prompt_confirm(
        "Continue anyway? (the download will fail until the token is set)",
        default=False,
    )


def _resolve_token(token_env: str) -> str | None:
    try:
        from corpora_builder.hf_download import resolve_hf_token
        return resolve_hf_token(token_env)
    except Exception:
        import os
        return os.environ.get(token_env)


def _license_is_non_commercial(license_str: str | None) -> bool:
    """Thin wrapper so the guided flow shares the NC detection SSOT."""
    from mt_eval_harness.license_use import is_non_commercial
    return is_non_commercial(license_str)


# ---------------------------------------------------------------------------
# Gate — when may the guided flow run?
# ---------------------------------------------------------------------------

def should_run_guided(args) -> bool:
    """True only when it's safe to prompt: TTY in+out, no corpus, not opted out.

    An agent / CI / piped invocation is non-TTY, so this returns False and the
    run command falls through to its normal (machine-readable) error path —
    it never hangs waiting for input.
    """
    if getattr(args, "json", False):
        return False
    if getattr(args, "non_interactive", False):
        return False
    # A corpus (or parallel-text pair) was already given — nothing to guide.
    if getattr(args, "corpus", None):
        return False
    if getattr(args, "source_file", None) and getattr(args, "reference_file", None):
        return False
    return sys.stdin.isatty() and sys.stdout.isatty()
