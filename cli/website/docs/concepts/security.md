---
sidebar_position: 4
title: Security
---

# Security & Safety

Champollion is designed to be safe in adversarial environments — where locale data might come from untrusted sources, where crafted file names could escape directory boundaries, and where LLM output can contain anything.

## Threat Model

| Threat | Attack Vector | Mitigation |
|--------|--------------|-----------|
| **Prototype pollution** | Crafted JSON keys (`__proto__`, `constructor`) | Rejected at parse time |
| **Path traversal** | Locale codes like `../../etc/passwd` | File writes validated to configured directories |
| **Code block corruption** | LLM translates inside code fences | Unicode sentinel shielding |
| **Hallucinated keys** | LLM returns keys that weren't sent | Response validation — only accepted keys are written |
| **Runaway token spend** | Infinite retry loops | Budget-capped via `maxRetries` |

## Prototype Pollution Guard

All locale keys are validated against a blocklist before processing:

- `__proto__`
- `constructor`
- `prototype`

Any key matching these patterns is rejected with an error. This prevents attackers from using crafted locale files to modify JavaScript object prototypes.

## Path Containment

When writing locale files, champollion validates that the output path stays within the configured directories (`localesDir`, `contentDir`). Locale codes are sanitized — a code like `../../secrets` cannot write outside the expected directory.

## Block Protection

During Markdown content translation, structured elements are replaced with Unicode sentinel placeholders before the text is sent to the LLM:

1. **Code blocks** (fenced and inline) → sentinel
2. **Hugo shortcodes** (`{{< >}}`, `{{% %}}`) → sentinel  
3. **Raw HTML** → sentinel
4. **Interpolation variables** (`{{ .Count }}`) → sentinel

After translation, sentinels are replaced with the original content. The LLM never sees code blocks, shortcodes, or HTML — it can't corrupt them.

## Response Validation

When the LLM returns a JSON response, champollion validates that:
- Only keys that were sent in the batch appear in the response
- No extra keys are injected
- The response parses as valid JSON

Hallucinated keys are silently dropped. This prevents LLM output from injecting unexpected translations into your locale files.

## Quality Gate

Every translation is validated through five deterministic checks before it's written to disk. See [Quality Gate](/docs/concepts/quality-gate) for details.

## Exponential Backoff

API calls use exponential backoff with jitter on 429 (rate limit) and 5xx (server error) responses. Three retries with increasing delay prevent hammering the API during outages.

## Request Timeout

Every API request has a 30-second timeout via `AbortController`. This prevents the sync process from hanging indefinitely on a dead connection.

## Fail-Loud Translation Failures

When the API is unavailable or a translation fails, champollion throws a loud error with actionable guidance instead of silently writing garbage. No `[EN]`-prefixed placeholders are ever written during sync.

```
[ERR] Content sync for fr: no API key available.
  Set OPENROUTER_API_KEY in .env.local to translate content.
```

One file's failure doesn't stop the entire sync — the error is logged and the pipeline continues to the next file, so you get maximum progress per run.

## Post-Sync Verification

After all translations complete, champollion re-reads the written locale files from disk and runs a verification pass. This catches the gap between sync reporting success and translations being wrong in fact:

- **Key parity** — all source keys present in each target
- **`[EN]` markers** — legacy fallback markers from prior runs
- **Empty translations** — blank values that slipped through
- **Script compliance** — non-Latin locales with ASCII-only translations
- **Placeholder preservation** — ICU placeholders match source

Skip with `--no-verify` or run standalone with `npx champollion verify`.

## Testing

Security properties are verified by the adversarial test suite:

```bash
npm run test:redteam    # prototype pollution, path traversal, encoding attacks
```

---

## See Also

- [Architecture](/docs/concepts/architecture) — how the three-piece ecosystem connects
- [CLI Reference — integrity](/docs/reference/cli#integrity) — integrity checking command
- [CLI Reference — provenance](/docs/reference/cli#provenance) — provenance auditing command
- [Plugin Specification](/docs/reference/plugin-spec) — provenance fields in plugin manifests
- [Quality Gate](/docs/concepts/quality-gate) — translation-level safety checks
