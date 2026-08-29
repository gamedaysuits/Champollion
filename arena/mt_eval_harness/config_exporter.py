"""
Config exporter — generate champollion.config.json snippets from TestReports.

Usage:
    mt-eval export-config --report report.json --target-lang-code crk

Produces a JSON fragment using the canonical MethodConfig shape that can
be merged directly into an existing champollion.config.json. The format is
identical to what method.json, the leaderboard, and --install use.

Why:
    After finding a winning configuration in the harness, this command
    generates the exact champollion.config.json settings needed to deploy
    that configuration in production. "Test what you ship."
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from mt_eval_harness.config import MODEL_REGISTRY
from mt_eval_harness.method_manifest import manifest_entries
from mt_eval_harness.scoring import classify_quality_tier

# Version of the export format. Bumped when fields are added/changed.
EXPORT_FORMAT_VERSION = "1.0.0"


def _to_iso639_1(code: str) -> str:
    """Map an ISO 639-3 code (or alias) to its ISO 639-1 two-letter form.

    The harness records language codes as ISO 639-3 ("eng", "amh", "fra"),
    but a conventional i18n project keys its message catalogues by the
    two-letter ISO 639-1 code (en.json, fr.json, de.json). Exporting the raw
    639-3 code would emit an ``inputLocale`` / pair key that never matches a
    normal project, so we resolve the 639-1 form through the language-card
    SSOT (the single source of truth for every code form — no hardcoded table).

    Fail-open: returns the input unchanged when no 639-1 equivalent exists
    (e.g. Plains Cree "crk" has none), when the code is unknown, or when the
    card SSOT is unavailable. Never raises — an export must not crash on an
    exotic code. Idempotent for codes already in 639-1 form ("fr" -> "fr").
    """
    if not code:
        return code
    try:
        from mt_eval_harness.language_cards import get_card, resolve_code
        card = get_card(resolve_code(code))
        if card:
            iso1 = card.get("iso639_1")
            if iso1:
                return iso1
    except Exception:
        pass
    return code

# The CLI's valid `defaultMethod` values — the keys of its METHOD_REGISTRY
# (cli/lib/translate.js). The harness uses DIFFERENT vocabularies internally
# (`prompt_version`: naive | coached | custom | champollion for LLM runs;
# `mt_method`: deepl | google-translate | ... for MT-API runs), so an export
# MUST translate; a raw passthrough writes a config the CLI rejects with
# "Unknown translation method" (pre-launch audit 2026-06-13, blocking #1).
# Keep this in sync with cli/lib/translate.js METHOD_REGISTRY.
_CLI_METHODS = frozenset({
    "llm", "llm-coached", "google-translate", "api", "deepl",
    "microsoft-translator", "libretranslate", "apertium", "tilde", "translated",
    "openai", "anthropic", "gemini", "local", "external",
})

# Harness mt_method -> CLI defaultMethod, for MT-API engines the CLI can run.
# The shared method-registry SSOT (shared/method-registry.json) deliberately
# uses the SAME name in both runtimes, so the mapping is identity; this embedded
# mirror is the standalone-install fallback for when that SSOT file isn't on
# disk (mirrors config._load_model_aliases' fallback pattern). Harness-only
# engines (amazon-translate / local-model, runtimes=["harness"] in the SSOT)
# have NO CLI adapter and are intentionally absent here so exporting them fails
# loud rather than emitting a config the CLI cannot run.
_MT_METHOD_TO_CLI_FALLBACK = {
    "google-translate": "google-translate",
    "deepl": "deepl",
    "microsoft-translator": "microsoft-translator",
    "libretranslate": "libretranslate",
    "apertium": "apertium",
    "tilde": "tilde",
    "translated": "translated",
}


def _mt_method_to_cli_map() -> dict[str, str]:
    """Map every CLI-runnable MT-API engine name to its CLI ``defaultMethod``.

    Derives from the shared method-registry SSOT when present (so a newly added
    engine round-trips with no code change here), else uses the embedded
    standalone mirror. Engines whose SSOT ``runtimes`` allowlist excludes the
    CLI (e.g. ``amazon-translate``: ``["harness"]``) are dropped — they have no
    CLI adapter, so exporting them must fail loud, not write an unrunnable config.
    """
    entries = manifest_entries("mt-api")  # {} when the SSOT file isn't present
    if not entries:
        return dict(_MT_METHOD_TO_CLI_FALLBACK)
    mapping: dict[str, str] = {}
    for name, entry in entries.items():
        runtimes = entry.get("runtimes")
        # Absent runtimes => available everywhere (incl. the CLI). An explicit
        # allowlist that omits "cli" => harness-only; skip it (export fails loud).
        if runtimes is not None and "cli" not in runtimes:
            continue
        mapping[name] = entry.get("cli_name", name)
    return mapping

# Harness prompt_version -> CLI defaultMethod. `custom` and `champollion`
# are harness-only prompt strategies with no portable CLI equivalent; we map
# them to the closest deployable method (coached) and annotate the snippet so
# the operator knows the prompt nuance is not reproduced by the CLI.
_PROMPT_VERSION_TO_METHOD = {
    "naive": "llm",
    "coached": "llm-coached",
    "custom": "llm-coached",
    "champollion": "llm-coached",
}
_NON_PORTABLE_PROMPT_VERSIONS = frozenset({"custom", "champollion"})


def _resolve_default_method(
    prompt_version: str | None,
    mt_method: str | None = None,
) -> tuple[str, str | None]:
    """Map a harness run to a CLI-valid `defaultMethod`.

    Returns (method, note). `note` is a human-readable caveat when the
    harness prompt strategy has no exact CLI equivalent, else None.
    Raises ValueError if the result is somehow not a CLI method — the
    export refuses to emit a config that would crash the CLI.

    MT-API runs (``--method deepl`` / ``google-translate`` / ...) set
    ``mt_method``; for them ``prompt_version`` is meaningless (always
    'naive'). The ENGINE, not the prompt strategy, picks the CLI method, so
    branch on ``mt_method`` FIRST. Without this, every MT-API run exported as
    defaultMethod 'llm' with the engine name as the model — a config that
    invokes the LLM path against a nonexistent OpenRouter model, breaking the
    "test what you ship" interop promise.
    """
    mt = (mt_method or "").strip().lower()
    if mt:
        cli_map = _mt_method_to_cli_map()
        method = cli_map.get(mt)
        if method is None:
            # No CLI adapter for this engine — fail loud, never silently emit
            # 'llm' (which would crash the CLI against a fake model).
            raise ValueError(
                f"Cannot export config: MT engine {mt!r} has no Champollion CLI "
                f"equivalent, so an export would write a config the CLI cannot "
                f"run. CLI-runnable MT engines: {sorted(cli_map)}. "
                f"Harness-only engines (e.g. 'amazon-translate', 'local-model') "
                f"carry runtimes=['harness'] in shared/method-registry.json and "
                f"have no CLI adapter."
            )
        if method not in _CLI_METHODS:  # defensive — SSOT/CLI drift
            raise ValueError(
                f"Internal error: MT engine {mt!r} mapped to {method!r}, which "
                f"is not a valid CLI method {sorted(_CLI_METHODS)}. The shared "
                f"method-registry SSOT and the CLI METHOD_REGISTRY have drifted "
                f"— resync cli/lib/translate.js and config_exporter._CLI_METHODS."
            )
        return method, None

    pv = (prompt_version or "naive").strip()
    method = _PROMPT_VERSION_TO_METHOD.get(pv)
    note = None
    if method is None:
        # Unknown prompt_version — fail loud rather than passthrough.
        raise ValueError(
            f"Cannot export config: unknown prompt_version {pv!r}. "
            f"Known: {sorted(_PROMPT_VERSION_TO_METHOD)}. "
            f"Add a mapping in config_exporter._PROMPT_VERSION_TO_METHOD."
        )
    if pv in _NON_PORTABLE_PROMPT_VERSIONS:
        note = (
            f"Harness prompt mode {pv!r} has no exact CLI equivalent; "
            f"exported as {method!r}. The CLI will reproduce the model and "
            f"settings but not the {pv!r} prompt strategy."
        )
    if method not in _CLI_METHODS:  # defensive — should be unreachable
        raise ValueError(
            f"Internal error: mapped method {method!r} is not a valid CLI "
            f"method {sorted(_CLI_METHODS)}."
        )
    return method, note


def _extract_composite_score(overall: dict) -> float | None:
    """Pull the composite score out of a TestReport's `overall` block.

    TestReports store the composite under
    `overall.confidence_intervals.composite_score.score`, not as a
    top-level `overall.composite_score`. Check the CI block first, then
    fall back to a top-level key for forward compatibility.
    """
    ci_block = overall.get("confidence_intervals") or {}
    composite_ci = ci_block.get("composite_score") or {}
    score = composite_ci.get("score")
    if score is not None:
        return score
    return overall.get("composite_score")


def export_champollion_config(
    report_path: str | Path,
    target_lang_code: str,
    output_path: str | Path | None = None,
) -> dict:
    """Read a TestReport and emit a champollion.config.json snippet.

    The output uses the canonical MethodConfig shape — the same field names
    and structure used by champollion.config.json, method.json, leaderboard
    publish, and leaderboard install.

    Args:
        report_path: Path to the TestReport JSON file.
        target_lang_code: BCP-47 language code (e.g., "crk", "fr").
        output_path: Path to write the JSON output. If None, writes to stdout.

    Returns:
        The config snippet as a dict.
    """
    report_path = Path(report_path)
    if not report_path.exists():
        print(f"ERROR: Report not found: {report_path}", file=sys.stderr)
        sys.exit(1)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    config = report.get("config", {})
    overall = report.get("overall", {})

    # MT-API runs carry an mt_method (deepl, google-translate, ...). For them
    # the engine — not an LLM model/prompt — defines the method, so the model
    # field is meaningless (it holds the engine name, not an OpenRouter model).
    mt_method = (config.get("mt_method") or "").strip()
    is_mt = bool(mt_method)

    # Method-plugin runs (--method path/to/dir) are defined by the plugin,
    # not by an LLM model/prompt — and a custom plugin has no Champollion CLI
    # adapter, so an export would write a config the CLI cannot run. Refuse
    # loudly, naming the METHOD identity (mirroring the harness-only
    # MT-engine branch in _resolve_default_method) — never emit the phantom
    # LLM model the snippet would otherwise claim.
    method_path = (config.get("method_path") or "").strip()
    if method_path and not is_mt:
        _prov = report.get("provenance") or {}
        method_identity = (
            ((_prov.get("method_card") or {}).get("method_id"))
            # The runner relabels config.model to the method_id for plugin runs.
            or (config.get("model") or "").strip()
            or Path(method_path).name
        )
        raise ValueError(
            f"Cannot export config: this run was produced by method plugin "
            f"{method_identity!r} (from {method_path}), which has no "
            f"Champollion CLI equivalent. A champollion.config.json can only "
            f"describe CLI-runnable methods (LLM prompts or adapter-backed MT "
            f"engines); exporting this run would claim an LLM model that "
            f"never ran."
        )

    # Resolve model ID to full slug. MT-API engines have no LLM model, so null
    # it rather than emit a bogus `model` (e.g. "deepl") the reader could
    # mistake for an OpenRouter model.
    if is_mt:
        model = None
    else:
        model_raw = config.get("model", "")
        model = MODEL_REGISTRY.get(model_raw, model_raw)

    # Build the canonical MethodConfig
    method_config = {
        "model": model,
        "temperature": config.get("temperature"),
        "batchSize": config.get("batch_size"),
        "register": None,  # Comes from language card, not the report
        "coachingFile": config.get("coaching_file"),
        "coachingPrompt": None,  # Resolved at runtime — not stored
        "promptContext": None,  # Comes from project config, not the report
        "qualityTier": None,
    }

    # Extract register from provenance if available
    provenance = report.get("provenance", {})
    if provenance.get("register_used"):
        method_config["register"] = provenance["register_used"]

    # Build quality tier from scores. Reports don't store a tier — derive
    # it from the composite (SCORING_SPEC §5.1), preferring an explicit
    # report value if a future format adds one.
    composite_score = _extract_composite_score(overall)
    quality_tier = overall.get("quality_tier")
    if quality_tier is None and composite_score is not None:
        quality_tier = classify_quality_tier(composite_score)
    if quality_tier:
        method_config["qualityTier"] = quality_tier

    # Map the run to a CLI-valid method (never a raw passthrough — see
    # _resolve_default_method). MT-API runs map by engine; LLM runs by prompt.
    default_method, method_note = _resolve_default_method(
        config.get("prompt_version"),
        mt_method,
    )

    # Detect source language. The harness serializes the source ISO code under
    # `source_code` (RunConfig.source_code, config.py — the runner auto-fills it
    # from the corpus language_pair); there is NO `source_lang_code` field, so
    # reading that key meant every non-English-source run (e.g. fr→de) silently
    # fell through to "en" and deployed as en→de — the dead-branch interop bug.
    # Read `source_code` first; keep `source_lang_code` as a back-compat
    # fallback for any externally-authored report that used the old key.
    source_lang_code = (
        config.get("source_code")
        or config.get("source_lang_code")
        or "en"
    )
    # Normalize both sides to ISO 639-1 (en/fr/de) so the deployed config keys
    # match a conventional two-letter i18n project (en.json/fr.json). Codes with
    # no 639-1 equivalent (e.g. "crk") pass through unchanged. This also folds an
    # English source recorded as 639-3 "eng" back to "en", so the "skip
    # inputLocale for English" guard below fires correctly.
    source_lang_code = _to_iso639_1(source_lang_code)
    target_locale = _to_iso639_1(target_lang_code)
    target_lang_name = config.get("target_lang", target_lang_code)

    # Assemble the export snippet
    # This is a mergeable fragment — the user pastes it into their
    # existing champollion.config.json.
    snippet = {
        "_generated_by": f"mt-eval export-config v{EXPORT_FORMAT_VERSION}",
        "_source": str(report_path.name),
        "_timestamp": report.get("timestamp", ""),
        # Top-level method defaults
        "model": method_config["model"],
        "temperature": method_config["temperature"],
        "batchSize": method_config["batchSize"],
        "defaultMethod": default_method,
        # Per-language settings — keyed by the two-letter ISO 639-1 locale a
        # normal i18n project uses (falls back to the original code when there
        # is no 639-1 equivalent, e.g. "crk").
        "languages": {
            target_locale: {
                "register": method_config["register"],
            },
        },
    }

    # Include provider only when non-default (keeps OpenRouter exports clean
    # and backward-compatible; direct provider exports are explicit).
    provider_name = config.get("provider", "openrouter")
    if provider_name and provider_name != "openrouter":
        snippet["provider"] = provider_name
    if method_note:
        snippet["_method_note"] = method_note

    # Include coaching file reference if used
    if method_config["coachingFile"]:
        snippet["coachingFile"] = method_config["coachingFile"]

    # Include per-pair override if source isn't English. Carry the source
    # code explicitly (inputLocale) so a non-English-source config doesn't
    # silently default to English on the CLI side. Both sides are ISO 639-1
    # (above) so the pair key matches a conventional two-letter project.
    if source_lang_code and source_lang_code != "en":
        pair_key = f"{source_lang_code}:{target_locale}"
        snippet["inputLocale"] = source_lang_code
        snippet["pairs"] = {
            pair_key: {
                "model": method_config["model"],
                "temperature": method_config["temperature"],
            },
        }

    # Add benchmark summary for reference (not config, just FYI)
    snippet["_benchmark_summary"] = {
        "corpus_size": overall.get("total_entries", 0),
        "exact_match_rate": overall.get("exact_match_rate"),
        "chrf_plus_plus": overall.get("corpus_chrf"),
        "composite_score": composite_score,
        "quality_tier": quality_tier,
    }

    # Output
    output_json = json.dumps(snippet, indent=2, ensure_ascii=False) + "\n"

    if output_path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output_json, encoding="utf-8")
        print(f"  ✅ Config snippet written to: {output_path}")
    else:
        print(output_json)

    return snippet


def cmd_export_config(args) -> None:
    """CLI entry point for the export-config subcommand."""
    try:
        export_champollion_config(
            report_path=args.report,
            target_lang_code=args.target_lang_code,
            output_path=getattr(args, "output", None),
        )
    except ValueError as exc:
        # An unmappable run — e.g. a harness-only MT engine (amazon-translate /
        # local-model) with no CLI adapter, or an unknown prompt_version —
        # raises ValueError from _resolve_default_method. This dispatch returns
        # before main()'s try/except, so without this catch the exception dumps
        # a raw Python traceback. Surface a clean error + exit 1, mirroring the
        # report-not-found exit in export_champollion_config.
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
