#!/usr/bin/env python3
"""
Live smoke test for the MT systems-under-test adapters.

Drives each REST-MT adapter (Google Translate, DeepL, Microsoft Translator)
through the SAME registry the harness will use, resolves credentials from the
environment, and makes ONE real API call per provider whose key is set.

This is a developer tool, not a unit test — it hits the network. Providers
whose key is absent are SKIPPED (clearly reported), never faked. Exit code is
non-zero only if a provider that HAS a key fails its round-trip, so this is
safe to run before any key is configured.

Usage:
    # from the arena/ directory, with whichever keys you have exported:
    python3 scripts/smoke_test_mt_methods.py
    python3 scripts/smoke_test_mt_methods.py --src en --tgt fr
    python3 scripts/smoke_test_mt_methods.py --text "Translate me." --tgt es

Env vars read (by the adapters themselves):
    GOOGLE_TRANSLATE_API_KEY   (or GOOGLE_API_KEY)
    DEEPL_API_KEY              (free keys end in ':fx', auto-detected)
    MICROSOFT_TRANSLATOR_API_KEY   + MICROSOFT_TRANSLATOR_REGION
                               (+ MICROSOFT_TRANSLATOR_ENDPOINT for custom-domain)
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time

# Make mt_eval_harness importable whether run from arena/ or elsewhere.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mt_eval_harness.methods.base_http_mt import MTConfigError  # noqa: E402
from mt_eval_harness.methods.registry import get_mt_method  # noqa: E402

# Provider name → the env var(s) that must be present for it to even attempt.
# (The adapter raises MTConfigError if the required one is missing; this map is
# only used to print an honest "set THIS" hint when we skip.)
KEY_HINTS = {
    "google-translate": "GOOGLE_TRANSLATE_API_KEY (or GOOGLE_API_KEY)",
    "deepl": "DEEPL_API_KEY",
    "microsoft-translator": "MICROSOFT_TRANSLATOR_API_KEY (+ MICROSOFT_TRANSLATOR_REGION)",
    "libretranslate": "LIBRETRANSLATE_API_URL (key optional; defaults to localhost:5000)",
    "apertium": "APERTIUM_API_URL (no key — public API; defaults to apertium.org/apy)",
    "amazon-translate": "AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION (IAM TranslateFullAccess; needs boto3)",
    "tilde": "TILDE_API_KEY (free trial key at translate.tilde.ai/access-keys)",
}

PROVIDERS = [
    "google-translate", "deepl", "microsoft-translator", "libretranslate",
    "apertium", "amazon-translate", "tilde",
]


async def run_one(name: str, texts: list[str], src: str, tgt: str) -> str:
    """Return a one-line status string for one provider; never raises."""
    method = get_mt_method(name)
    try:
        creds = method._resolve_credentials()
    except MTConfigError as exc:
        return f"  SKIP   {name:22} — no key. Set {KEY_HINTS[name]}.\n         ({exc})"

    t0 = time.monotonic()
    try:
        out = await method._translate_texts(texts, src, tgt, creds)
        dt = time.monotonic() - t0
    except Exception as exc:  # noqa: BLE001 - report, don't crash the sweep
        dt = time.monotonic() - t0
        return f"  FAIL   {name:22} — {type(exc).__name__}: {exc}  ({dt:.2f}s)"

    lines = [f"  OK     {name:22} — {len(out)} segment(s), {dt:.2f}s"]
    for s, t in zip(texts, out):
        lines.append(f"           {src}: {s!r}")
        lines.append(f"           {tgt}: {t!r}")
    return "\n".join(lines)


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", default="en", help="source ISO code (default: en)")
    ap.add_argument("--tgt", default="fr", help="target ISO code (default: fr)")
    ap.add_argument(
        "--text",
        action="append",
        help="text to translate (repeatable; defaults to two sample sentences)",
    )
    args = ap.parse_args()

    texts = args.text or ["Hello, world.", "How are you today?"]

    print(f"\nLive MT smoke test — {args.src} → {args.tgt}\n" + "=" * 60)
    statuses = [await run_one(p, texts, args.src, args.tgt) for p in PROVIDERS]
    print("\n".join(statuses))
    print("=" * 60)

    failed = [s for s in statuses if s.lstrip().startswith("FAIL")]
    ok = [s for s in statuses if s.lstrip().startswith("OK")]
    skipped = [s for s in statuses if s.lstrip().startswith("SKIP")]
    print(f"{len(ok)} ok · {len(failed)} failed · {len(skipped)} skipped\n")

    # Non-zero ONLY if a configured provider failed. All-skipped is exit 0.
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
