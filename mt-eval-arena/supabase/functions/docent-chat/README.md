# docent-chat

The champollion.dev **site docent** — a grounded, cost-metered, multilingual
guide (founder direction 2026-07-20). It gives visitors a tour, explains how to
get involved, handles the sovereignty-aspirant nuance, and warmly refuses
dev-work / translation-on-demand (redirecting to `llms.txt` + the MCP server).

It answers **only** from the project's public docs (bundled at
`_generated/docent-bundle.json`, built by `cli/scripts/build-docent-corpus.mjs`)
and has **no tools** — it explains and points, it cannot publish, rank, submit,
or change anything. Prompt injection can therefore only produce wrong words, and
grounding + citations bound even that.

## Request / response

```bash
curl -X POST "$SUPABASE_URL/functions/v1/docent-chat" \
  -H 'content-type: application/json' \
  -d '{"message":"how do I get involved if I only speak my language?","locale":"fil","register":"warm","history":[]}'
```

```json
{
  "ok": true,
  "mode": "model",
  "answer": "…grounded, in-locale answer…",
  "sources": [ { "title": "For Language Communities", "url": "https://champollion.dev/docs/network/community/for-language-communities" } ]
}
```

- `message` required; `locale` (default `en`), `register` (`warm`|`formal`),
  `history` (client-held, most-recent 12 turns) optional.
- `mode` ∈ `model | faq | degraded`. `degraded` (with `degraded_reason`) is the
  honest fallback — see below.
- `sources[]` always comes from retrieval (or the FAQ entry), so the widget can
  render citation links regardless of the model's wording.

## Modes & the honest degrade

1. **`faq`** — a strong match against the bundled FAQ short-circuits the model
   entirely (free). Conservative threshold; a weak match falls through.
2. **`model`** — lexical retrieval (BM25) over the docs → grounded model answer.
3. **`degraded`** — **no model call**, returns the most relevant doc links + the
   ticket form. Triggered when:
   - the global **daily token budget** is spent (`degraded_reason: daily_budget`)
     — the guide "rests for the day" instead of overspending;
   - **no API key** is configured (`unconfigured`) — the lane works on the dev
     branch before keys are set;
   - the model call **errors** (`model_error`) — never a raw upstream error,
     never a fabricated answer.

## Deploy

The grounding bundle (`_generated/docent-bundle.json`) is **build output and is
gitignored** — a clean checkout has none, and a stale one is worse than none.
Always rebuild and verify before deploying; step 2 exits non-zero rather than
emit an unusable bundle, and step 3 re-checks that what is on disk matches the
current docs.

```bash
# 1. migrations — apply 065/066/067 via the Supabase MCP `apply_migration`.
#    `supabase db push` does NOT work against this project.

# 2. (re)build the bundle — FATALs on an empty corpus or empty system prompt
node cli/scripts/build-docent-corpus.mjs

# 3. verify it matches the current docs tree (exit 3 = stale)
node cli/scripts/build-docent-corpus.mjs --check

# 4. deploy (needs SUPABASE_ACCESS_TOKEN — the only lane that uploads the ~1.7MB bundle)
supabase functions deploy docent-chat --no-verify-jwt
```

If a bad bundle ever does reach production, `validateBundle()` catches it at
cold start: the function logs the reason and serves the degraded
docs-and-ticket answer (`degraded_reason: "corpus_unavailable"`) rather than
letting the model answer ungrounded.

## Environment (function secrets)

| Var | Required | Default | Purpose |
|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes | — | platform-provided |
| `ANTHROPIC_API_KEY` | for the default lane | — | Anthropic first-party. **If unset, docent runs in degraded (docs+ticket) mode.** |
| `OPENROUTER_API_KEY` | if using OpenRouter | — | OpenRouter (pinned `data_collection: deny`) |
| `DOCENT_PROVIDER` | no | `anthropic` | `anthropic` \| `openrouter` |
| `DOCENT_MODEL` | no | `claude-haiku-4-5` | default model id |
| `DOCENT_MODEL_CONFIG` | no | `{}` | JSON `{ "<locale>": {"provider","model"} }` per-locale override (the eval program writes this) |
| `DOCENT_DAILY_TOKEN_BUDGET` | no | `500000` | output-token/day budget; crossing it degrades to docs+ticket |
| `DOCENT_IP_HOURLY_CAP` | no | `40` | per-IP requests/hour |
| `DOCENT_MAX_TOKENS` | no | `800` | max answer tokens |
| `DOCENT_TOP_K` | no | `6` | retrieved chunks per answer |
| `DOCENT_IP_SALT` | no | `champollion-docent-v1` | salt for the stored IP hash |
| `DOCENT_ALLOWED_ORIGINS` | no | `https://champollion.dev,https://www.champollion.dev` | CORS allowlist |

## Privacy

- Raw client IPs are **never stored** — only a salted SHA-256, for the rate
  window (migration 066).
- **No conversation content is stored** — `docent_usage` holds counters only
  (founder decision 2026-07-20: counts, not transcripts).
- OpenRouter calls are pinned `data_collection: deny`; Anthropic first-party is
  no-train by policy.

## Tests

```bash
deno test retrieval_test.ts lib_test.ts   # 20 pure unit tests
deno check index.ts                       # type-check the handler
```

## Evaluation

The docent is evaluated with the project's own harness before any locale ships —
see the docent eval program (`arena/.../docent-eval*` + `docent-eval-v1`
corpus). Per-locale winning models are written into `DOCENT_MODEL_CONFIG`.
