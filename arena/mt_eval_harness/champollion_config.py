"""
Champollion Config Reader — Load champollion.config.json for harness use.

Reads the production champollion config and language card files to
extract register, gender guidance, and prompt context for a specific
target language. This enables config interchangeability between the
production CLI and the evaluation harness.

The reader accesses language card JSON files directly from the filesystem
(no Node.js dependency). In a monorepo layout, the cards live at
`cli/shared/language-cards/`. For standalone usage, they'd be at
`node_modules/champollion/shared/language-cards/`.

Usage:
    rc = load_champollion_config("champollion.config.json", "fr", cards_dir="cli/shared/language-cards/")
    print(rc.register)         # "Use casual tu-form..."
    print(rc.gender_guidance)  # "Use écriture épicène..."
    print(rc.prompt_context)   # "This is a messaging app..."
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


# ---------------------------------------------------------------------------
# Language code resolution — delegates to language_cards SSOT
# ---------------------------------------------------------------------------
#
# Previously this module contained a 54-entry CODE_ALIASES dict duplicating
# what the language cards already provide. Deleted in v8 — all resolution
# now goes through the shared language_cards module which indexes all 7,928
# cards at startup.

from mt_eval_harness.language_cards import (
    resolve_code,
    resolve_name,
    get_card as get_language_card_from_ssot,
    get_name as get_language_name,
    _find_cards_dir as _lc_find_cards_dir,
)


# ---------------------------------------------------------------------------
# Language card reader
# ---------------------------------------------------------------------------

def _find_cards_dir() -> Path | None:
    """Auto-detect the language cards directory.

    Delegates to language_cards._find_cards_dir() — the single source of
    truth for card discovery — rather than maintaining a second, divergent
    copy. That finder resolves the real monorepo layout
    (`cli/shared/language-cards/`, located relative to this file), walks up
    from CWD, and falls back to the npm install path
    (`node_modules/champollion/shared/language-cards/`).

    Returns None if not found (caller should raise with a helpful message).
    """
    return _lc_find_cards_dir()


def load_language_card(code: str, cards_dir: Path) -> dict | None:
    """Load a single language card JSON file, recursively resolving extends parent cards.

    Scans the cards_dir recursively, indexing all cards by their 'code' property,
    then resolves aliases, base language fallbacks, and the extends hierarchy.
    """
    if not cards_dir.is_dir():
        return None

    all_cards = {}
    aliases = {}

    for p in cards_dir.rglob("*.json"):
        try:
            card = json.loads(p.read_text(encoding="utf-8"))
            card_code = card.get("code")
            if card_code:
                all_cards[card_code] = card
                for alias in card.get("aliases", []):
                    aliases[alias] = card_code
        except Exception as e:
            print(f"[WARN] Failed to parse card file {p}: {e}")

    resolved_cards = {}

    def resolve_card(c_code: str, visited=None) -> dict | None:
        if visited is None:
            visited = set()
        if c_code in visited:
            print(f"[WARN] Circular dependency detected for card code '{c_code}'")
            return None
        visited.add(c_code)

        if c_code in resolved_cards:
            return resolved_cards[c_code]

        # Try direct match in scanned cards
        card = all_cards.get(c_code)
        if not card:
            # Try alias resolution
            canonical = aliases.get(c_code)
            if not canonical:
                canonical = resolve_code(c_code)
            if canonical in all_cards:
                card = all_cards.get(canonical)
            elif "-" in c_code:
                # Try base language (strip region subtag)
                base = c_code.split("-")[0]
                card = all_cards.get(base)

        if not card:
            return None

        import copy
        card_copy = copy.deepcopy(card)

        # Resolve extends
        parent_code = card_copy.get("extends")
        if parent_code:
            parent_card = resolve_card(parent_code, visited)
            if parent_card:
                card_copy = deep_merge_cards(parent_card, card_copy)
            else:
                print(f"[WARN] Language card '{c_code}' extends unknown card '{parent_code}'.")

        resolved_cards[c_code] = card_copy
        return card_copy

    return resolve_card(code)


def deep_merge_cards(parent: dict, child: dict) -> dict:
    """Deep merge two dictionaries, child keys override parent keys."""
    merged = parent.copy()
    for key, value in child.items():
        if isinstance(value, dict) and key in merged and isinstance(merged[key], dict):
            merged[key] = deep_merge_cards(merged[key], value)
        else:
            merged[key] = value
    return merged


def _get_register_from_card(card: dict, preset_key: str | None = None) -> str | None:
    """Extract register prompt text from a language card.

    If preset_key is provided, looks up that specific preset.
    Otherwise uses the card's default (from formality.default or first key).

    Mirrors getRegister() in lib/registers.js.

    Card structure:
        card.registers = {
            "formal-vous": { "label": "...", "prompt": "Use vous-form...", ... },
            "casual-tu":   { "label": "...", "prompt": "Use tu-form...", ... }
        }
        card.formality.default = "formal-vous"  (optional)
    """
    registers = card.get("registers", {})
    if not registers:
        # No registers declared. Honor an explicit user/config override if given;
        # otherwise return None (no register) — do NOT fabricate one.
        return preset_key or None

    # No user override — use card's default preset
    if not preset_key:
        formality = card.get("formality", {})
        default_key = formality.get("default") or next(iter(registers), None)
        if default_key and default_key in registers:
            return registers[default_key].get("prompt") or None
        return None

    # Check if it's a preset name
    if preset_key in registers:
        return registers[preset_key].get("prompt") or None

    # Not a preset name — treat as custom register text (pass-through)
    return preset_key


def _get_gender_guidance(card: dict) -> str | None:
    """Extract gender guidance from a language card.

    Mirrors getGenderGuidance() in lib/registers.js.
    """
    gender = card.get("gender", {})
    guidance = gender.get("inclusiveGuidance")
    if guidance and isinstance(guidance, str) and len(guidance) > 10:
        return guidance
    return None


# ---------------------------------------------------------------------------
# Config reader
# ---------------------------------------------------------------------------

@dataclass
class ChampollionRunConfig:
    """Full configuration extracted from champollion.config.json.

    Contains everything needed to reproduce a production translation run:
    prompt shaping (register, gender, context) AND method configuration
    (model, temperature, batchSize, coaching).

    This is the canonical MethodConfig — the same shape used by
    method.json, the leaderboard, and export-config.
    """
    target_lang_name: str        # Human-readable name, e.g., "French"
    target_lang_code: str        # BCP-47 code, e.g., "fr"

    # --- Prompt shaping ---
    register: str | None         # Register text for prompt injection, or None (omitted)
    gender_guidance: str | None  # Per-language gender guidance, or None
    prompt_context: str | None   # Global context string from config

    # --- Canonical MethodConfig fields ---
    source_lang_name: str = "English"  # Human-readable source name, resolved from sourceLocale
    model: str | None = None           # OpenRouter model slug
    temperature: float | None = None   # LLM sampling temperature
    batch_size: int | None = None      # Entries per API call
    method: str | None = None          # 'llm', 'llm-coached', etc.
    coaching_file: str | None = None   # Path to coaching prompt file
    coaching_prompt: str | None = None # Resolved coaching text (read from file)
    quality_tier: str | None = None    # 'standard', 'high', 'research', 'verified'


# Back-compat alias — old code may reference the old name
ChampollionPromptConfig = ChampollionRunConfig


def load_champollion_config(
    config_path: str | Path,
    target_lang_code: str,
    cards_dir: str | Path | None = None,
) -> ChampollionRunConfig:
    """Load a champollion.config.json and extract full run config for a target language.

    This is the bridge between the champollion config format and the harness.
    It reads the same config file that the production CLI reads, and
    extracts the register, gender guidance, prompt context, model,
    temperature, batchSize, and coaching for the specified target language.

    Args:
        config_path: Path to champollion.config.json.
        target_lang_code: BCP-47 code for the target language (e.g., "fr").
        cards_dir: Path to language-cards directory. If None, auto-detects
            from monorepo layout or npm install.

    Returns:
        ChampollionRunConfig with all fields populated.

    Raises:
        FileNotFoundError: If config or cards directory not found.
        ValueError: If target language has no card.
    """
    config_path = Path(config_path)
    if not config_path.exists():
        raise FileNotFoundError(f"Champollion config not found: {config_path}")

    champollion_config = json.loads(config_path.read_text(encoding="utf-8"))

    # Resolve the language card. An explicit cards_dir is honored as-is
    # (back-compat / offline override). Otherwise we go through the
    # language_cards SSOT — which resolves a local dir, else fetches the card
    # from Supabase, else FAILS LOUD — so a standalone `pip install` gets
    # register/gender guidance instead of a silent filesystem miss.
    if cards_dir:
        cards_dir = Path(cards_dir)
        if not cards_dir.is_dir():
            raise FileNotFoundError(
                f"Language cards directory not found: {cards_dir}. "
                f"Set --champollion-cards-dir to a directory of language card "
                f"JSON files (e.g., cli/shared/language-cards/), or omit it to "
                f"fetch cards from Supabase."
            )
        card = load_language_card(target_lang_code, cards_dir)
    else:
        # SSOT path: local-or-remote-or-fail-loud (never a silent None).
        card = get_language_card_from_ssot(target_lang_code)

    if not card:
        raise ValueError(
            f"No language card found for '{target_lang_code}'. The code may be "
            f"unknown, or its card may not be published. "
            f"(source: {'--champollion-cards-dir' if cards_dir else 'language_cards SSOT'})"
        )

    # Resolve register preset override from config.
    #
    # The production config supports two entry points for register overrides:
    #
    # 1. "languages" block (simple mode):
    #    "languages": { "fr": "casual-tu" }
    #    "languages": { "fr": { "register": "casual-tu" } }
    #    "languages": ["fr", "de"]  (no override, uses card default)
    #
    # 2. "pairs" block (advanced mode — most common in real configs):
    #    "pairs": { "en:fr": { "register": "casual-tu" } }
    #
    # We check both, with languages taking precedence (mirrors the JS
    # resolution order in pairs.js where languages are applied first,
    # then pairs override).
    preset_override = None
    source_locale = champollion_config.get("sourceLocale", "en")

    # Resolve source language name from its language card
    from mt_eval_harness.language_cards import get_name as lc_get_name
    # Resolve the source language's name from the cards SSOT. If it can't be
    # resolved, do NOT assert "English" for a non-English source — only an en-*
    # locale is English; otherwise fall back to the locale code itself.
    source_lang_name = lc_get_name(source_locale) or (
        "English"
        if (source_locale or "").lower().startswith("en")
        else (source_locale or "the source language")
    )

    canonical = resolve_code(target_lang_code)

    # Check "languages" block first
    languages = champollion_config.get("languages", {})
    if isinstance(languages, dict) and languages:
        lang_config = languages.get(target_lang_code) or languages.get(canonical)
        if isinstance(lang_config, str):
            preset_override = lang_config
        elif isinstance(lang_config, dict) and "register" in lang_config:
            preset_override = lang_config["register"]
    elif isinstance(languages, list):
        pass  # Array form: ["fr", "de"] — no register override

    # Check "pairs" block if languages didn't specify a register
    pairs = champollion_config.get("pairs", {})
    if not preset_override:
        if isinstance(pairs, dict):
            # Try common pair key formats: "en:fr", "en→fr"
            pair_key = f"{source_locale}:{target_lang_code}"
            pair_config = pairs.get(pair_key)
            if pair_config is None:
                pair_key = f"{source_locale}:{canonical}"
                pair_config = pairs.get(pair_key)
            if pair_config is None:
                # Try arrow format
                pair_key = f"{source_locale}→{target_lang_code}"
                pair_config = pairs.get(pair_key)
            if pair_config is None:
                pair_key = f"{source_locale}→{canonical}"
                pair_config = pairs.get(pair_key)

            if isinstance(pair_config, dict) and "register" in pair_config:
                preset_override = pair_config["register"]

    # Also check top-level registerPreset as a global default
    if not preset_override:
        preset_override = champollion_config.get("registerPreset")

    # Build the prompt config
    register = _get_register_from_card(card, preset_override)
    gender_guidance = _get_gender_guidance(card)
    prompt_context = champollion_config.get("promptContext")

    # Language name from card
    lang_name = card.get("name", target_lang_code)

    # --- Extract canonical MethodConfig fields ---
    # Resolution order for each field:
    #   1. Per-pair override (from pairs[src:target] or languages[code])
    #   2. Top-level config default
    #   3. None (not set — RunConfig defaults apply)

    # Helper: get a field from pair config first, then top-level config
    def _resolve_field(field_name: str, pair_cfg: dict | None = None):
        if pair_cfg and isinstance(pair_cfg, dict) and field_name in pair_cfg:
            return pair_cfg[field_name]
        return champollion_config.get(field_name)

    # Find the pair config for this target (may have been found above)
    resolved_pair_cfg = None
    if isinstance(pairs, dict):
        for key_fmt in [
            f"{source_locale}:{target_lang_code}",
            f"{source_locale}:{canonical}",
            f"{source_locale}→{target_lang_code}",
            f"{source_locale}→{canonical}",
        ]:
            if key_fmt in pairs and isinstance(pairs[key_fmt], dict):
                resolved_pair_cfg = pairs[key_fmt]
                break

    # Also check languages block for per-language overrides
    resolved_lang_cfg = None
    if isinstance(languages, dict):
        lang_cfg = languages.get(target_lang_code) or languages.get(canonical)
        if isinstance(lang_cfg, dict):
            resolved_lang_cfg = lang_cfg

    # Merge: pair > language > top-level
    def _resolve(field_name: str):
        for source in [resolved_pair_cfg, resolved_lang_cfg]:
            if source and isinstance(source, dict) and field_name in source:
                return source[field_name]
        return champollion_config.get(field_name)

    model = _resolve("model")
    temperature_raw = _resolve("temperature")
    temperature = float(temperature_raw) if temperature_raw is not None else None
    batch_size_raw = _resolve("batchSize")
    batch_size = int(batch_size_raw) if batch_size_raw is not None else None
    method = _resolve("defaultMethod") or _resolve("method")
    coaching_file = _resolve("coachingFile")

    # If a coaching file is specified, try to read its contents
    coaching_prompt = None
    if coaching_file:
        coaching_path = Path(coaching_file)
        # Try relative to the config file's directory
        if not coaching_path.is_absolute():
            coaching_path = config_path.parent / coaching_file
        if coaching_path.exists():
            coaching_prompt = coaching_path.read_text(encoding="utf-8").strip()

    return ChampollionRunConfig(
        target_lang_name=lang_name,
        target_lang_code=target_lang_code,
        source_lang_name=source_lang_name,
        register=register,
        gender_guidance=gender_guidance,
        prompt_context=prompt_context,
        model=model,
        temperature=temperature,
        batch_size=batch_size,
        method=method,
        coaching_file=coaching_file,
        coaching_prompt=coaching_prompt,
    )


# ---------------------------------------------------------------------------
# Prompt builder — Python port of buildSystemMessage() from llm.js
# ---------------------------------------------------------------------------
#
# This MUST produce identical output to the JS function in:
#   lib/methods/llm.js → buildSystemMessage(langConfig)
#
# The JS function accepts:
#   { name, register, genderGuidance?, promptContext?, coachingPrompt? }
# and returns a system prompt string. This Python function takes a
# ChampollionRunConfig (same fields, different naming convention) and
# returns the same string.
#
# SYNC NOTE: If the JS prompt template changes, update this function
# and verify with the parity test.
# ---------------------------------------------------------------------------

def build_champollion_system_prompt(rc: ChampollionRunConfig) -> str:
    """Build a system prompt identical to production buildSystemMessage().

    This is a direct port of the JS function. The output must be
    character-for-character identical for the same inputs.

    Args:
        rc: ChampollionRunConfig extracted from a champollion config + card.

    Returns:
        System prompt string, ready for LLM API call.
    """
    # Gender guidance: use language-specific guidance from card when available,
    # otherwise fall back to a generic rule.
    if rc.gender_guidance:
        gender_rule = f"- Gender: {rc.gender_guidance}"
    else:
        gender_rule = (
            f"- When gender is ambiguous, prefer gender-neutral forms "
            f"or the most inclusive option available in {rc.target_lang_name}."
        )

    # Optional prompt context block
    if rc.prompt_context:
        context_block = f"\nContext: {rc.prompt_context}\n"
    else:
        context_block = ""

    # Optional coaching guidance block
    # This MUST match the JS insertion point exactly:
    #   after "Register/tone:" line, before "Rules:" section
    if rc.coaching_prompt:
        coaching_block = f"\nCoaching guidance:\n{rc.coaching_prompt}\n"
    else:
        coaching_block = ""

    # Only emit a Register/tone instruction when the card (or config) actually
    # declares one. Omit it otherwise — never fabricate a "Professional
    # register." the card never specified (that would be invented guidance in
    # the system prompt the model is asked to follow).
    register_block = f"Register/tone: {rc.register}\n" if rc.register else ""

    return (
        f"You are translating UI strings for a web/mobile application "
        f"from {rc.source_lang_name} to {rc.target_lang_name}.\n"
        f"{context_block}\n"
        f"{register_block}"
        f"{coaching_block}\n"
        f"Rules:\n"
        f"- Translate ONLY the values, keep the keys exactly as-is.\n"
        f"- Proper nouns (product names, company names, place names) "
        f"should NOT be translated.\n"
        f"- Technical terms and role descriptions that are industry-standard "
        f"should stay in {rc.source_lang_name}.\n"
        f"{gender_rule}\n"
        f"- Respect the UI element type: button labels should be concise, "
        f"descriptions can be natural-length, error messages should be clear "
        f"and direct.\n"
        f"- Return ONLY valid JSON, no markdown fences, no explanation."
    )

