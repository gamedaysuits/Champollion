# champollion-mcp-server

MCP (Model Context Protocol) server for Champollion. Lets AI agents browse the public benchmark queue, search language metadata, and run `mt-eval` benchmarks — all through natural conversation.

> **Champollion** is infrastructure for trustworthy machine translation across every language — source-available and free for noncommercial use (the evaluation harness and shared registries are open source) — the test sets and the map that show who can translate what, how good each method is, and where the gaps are. Public benchmarks on open data rank every method (human and machine); sovereign benchmarks are secret community-owned test sets we never see. The infrastructure is source-available and singly stewarded; the test sets and the methods for a community's language belong to that community — built with communities, never scraped from them. This server is the agent-facing door into that network ([champollion.dev/docs/network](https://champollion.dev/docs/network/)). This server itself is PolyForm Noncommercial 1.0.0 (see [LICENSE](LICENSE)).

## What it does

When connected to an agent (Claude Code, Antigravity, Cursor, etc.), the server exposes tools, resources, and prompts:

### Tools

| Tool | Type | Description |
|---|---|---|
| `list_queue` | Read-only | Browse open benchmark items, filter by language/model/budget |
| `get_queue_item` | Read-only | Get full details for a specific queue item |
| `estimate_cost` | Read-only | Estimate cost for a set of benchmark runs |
| `search_languages` | Read-only | Search language cards by name, code, family, or region |
| `get_project_info` | Read-only | Get a Champollion project overview |
| `get_results` | Read-only | Read scored runs from the public leaderboard (closes the run → see-impact loop) |
| `get_run_card` | Read-only | Get one run card (scores + method/config metadata) by id |
| `get_metric_reliability` | Read-only | Which metric to TRUST for a target language — correlations with WMT human judgments, per language family ([methodology](https://champollion.dev/docs/network/specifications/metric-reliability)) |
| `get_training_guardrails` | Read-only | How to train an NMT model without fooling yourself — the guardrail rules (group-disjoint splits, dev-fence, leak audits, preregistration, …) extracted from real measured failures, each naming its enforcing tool in `forge/` (nmt-forge) |
| `translate` | Action | Translate texts through champollion's tested pipeline — engine choice, register conditioning, persistent Translation Memory (repeats are free), deterministic quality gate. Spends API tokens only on cache misses |
| `run_benchmark` | Action | Start benchmarks via the mt-eval harness — launches in the background and returns a job id immediately |
| `get_run_status` | Read-only | Poll a benchmark job by id until it completes (the run continues past the client's 60s timeout) |

#### Training tools (nmt-forge)

These wrap the [nmt-forge](https://github.com/gamedaysuits/Champollion) training suite. forge is part of the Champollion monorepo (not on PyPI) — clone the repo and set `CHAMPOLLION_FORGE_DIR` to its `forge/` directory; scoring additionally needs the eval harness (`pip install mt-eval-harness`). Without forge present these tools return an actionable error rather than crashing.

| Tool | Type | Description |
|---|---|---|
| `forge_status` | Read-only | Where am I in an nmt-forge project and what do I run next — call first and after every step |
| `forge_preflight` | Read-only | Will this command refuse? Renders every gate it will hit (✓/✗ with the fix for each ✗) |
| `forge_discover` | Read-only | What a language HAS — reads the SSOT language card (scripts, analyzers, dictionaries, corpora) |
| `forge_init` | Action | Scaffold a forge project from a language card: workspace + starter config + NEXT_STEPS brief |
| `forge_split` | Action | Carve a parallel corpus into GROUP-DISJOINT train/dev/test (shared-source/target pairs stay together) |
| `forge_leak_audit` | Read-only | Screen a corpus against every registered eval set BEFORE training (exact/near-dupe detection) |
| `forge_register_eval` | Action | Register an eval file in the workspace with a role: dev (fenced selection) or test (prereg-gated) |
| `forge_prereg` | Action | Preregister falsifiable predictions for a test/sealed set BEFORE scoring it |
| `forge_evaluate` | Action | Close the loop: decode the config's battery with the selected checkpoint, score via the mt-eval harness (forge implements zero metrics itself) |
| `forge_lint` | Read-only | Diagnose a battery manifest: weak registers and the likeliest cause given co-occurring signals |
| `forge_report` | Read-only | Re-render the plain-language training report (with the Diagnosis section) from a manifest |

### Resources (read-only data)

| Resource | URI | Description |
|---|---|---|
| Contributing guide | `champollion://contributing-guide` | CONTRIBUTING.md — how to help with the project |
| Queue schema | `champollion://queue-schema` | Field definitions for every queue.json item |
| Network data map | `champollion://network-data` | Which machine artifact answers which question (queue, mesh, registry, coverage) |

### Prompts (conversation starters)

| Prompt | Arguments | Description |
|---|---|---|
| `contribute_compute` | `budget?`, `language?` | "I want to help — what would $X buy?" |
| `compete_for_prize` | `language?` | "I want to build a competitive method — any prizes?" |
| `explore_language` | `language` | "Tell me about [language] in Champollion" |

## Quick start

**From the published package** (no clone needed):

```bash
npx champollion-mcp-server    # start on stdio (for agent connection)

```

**From source:**

```bash
cd mcp-server
npm install
npm test          # run unit tests
npm start         # start on stdio (for agent connection)
```

## Connect to your agent

### Claude Code / Antigravity

Add to your MCP configuration — published package:

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

Or from a local checkout:

```json
{
  "mcpServers": {
    "champollion": {
      "command": "node",
      "args": ["/path/to/Champollion/mcp-server/bin/server.js"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` (same two options):

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

## What a conversation looks like

Once connected, you can talk to your agent naturally:

> **You:** "I want to help with Champollion — can you devote $10 in API credits to it?"
>
> **Agent** uses `get_project_info` → learns about the project
>
> **Agent** uses `list_queue` with `budget: 10` → sees what's available
>
> **Agent:** "The queue has over 200,000 open benchmark items. Your $10 could fund dozens of runs. Any preference on languages?"
>
> **You:** "West African languages"
>
> **Agent** uses `list_queue` with `language: "african"` → filters results
>
> **Agent** uses `estimate_cost` → calculates the plan
>
> **Agent:** "I found 18 items for Yoruba, Hausa, Igbo, Zulu, Xhosa, and Luganda. Total: ~$1.64. Ready to run?"
>
> **You:** "Go for it"
>
> **Agent** uses `run_benchmark` with `budget: 10` → gets a **job id** back immediately (the run continues in the background)
>
> **Agent** polls `get_run_status` with that job id until it reports `COMPLETED`, then uses `get_results` to show what was scored

## Testing

```bash
npm test
```

Tests use mock data and don't make network calls. To test the server interactively:

```bash
npx @modelcontextprotocol/inspector node bin/server.js
```

## Architecture

```
mcp-server/
├── bin/server.js              Entry point (stdio transport)
├── instructions.md            Agent behavioral guide (loaded at connect time)
├── src/
│   ├── index.js               Server setup + tool/resource/prompt registration
│   └── tools/
│       ├── queue.js            Queue fetch, filter, cost estimation
│       ├── languages.js        Language card index + search
│       ├── results.js          Public leaderboard reads (scored run_cards)
│       ├── reliability.js      Metric-reliability lookups (which metric to trust)
│       ├── training.js         Training guardrails (get_training_guardrails)
│       ├── translate.js        Champollion translate pipeline wrapper
│       └── harness.js          mt-eval CLI wrapper
├── test/
│   ├── tools.test.js          Unit tests (node --test) + SSOT shared vectors
│   ├── harness.test.js        Unit tests for run_benchmark + the async job model
│   ├── results.test.js        Unit tests for the leaderboard read tools
│   ├── queue-fetch.test.js    Unit tests for queue fetching/caching
│   ├── reliability.test.js    Unit tests for metric-reliability lookups
│   ├── training.test.js       Unit tests for the training-guardrails tool
│   └── translate.test.js      Unit tests for the translate tool
├── package.json
└── README.md
```

## Protocol version — and the 2026-07-28 stateless spec

**Transport: stdio only.** One server process per agent, launched by the client.

MCP's [2026-07-28 revision](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
made the protocol **stateless by default** — the largest change since
authorization. It retires the `initialize`/`initialized` handshake and the
`Mcp-Session-Id` header, requires `Mcp-Method`/`Mcp-Name` HTTP headers so
gateways can route without parsing bodies, replaces held-open bidirectional
streams with Multi Round-Trip Requests, and deprecates Roots, Sampling, Logging
and the legacy HTTP+SSE transport (twelve-month support window).

**Where this server stands (checked 2026-08-01):**

| | Status |
|---|---|
| Deprecated capabilities (Roots / Sampling / Logging) | **None used.** |
| Legacy HTTP+SSE transport | **Not used** — stdio only. |
| `Mcp-Session-Id`, header routing, MRTR | **Not applicable** to stdio. |
| Application state across calls | **Already uses the prescribed pattern** — see below. |
| SDK support for `2026-07-28` | **Not yet available.** |

The new spec's guidance for cross-call state is to "mint an explicit handle from
a tool and have the model pass it back as an argument" rather than lean on
transport sessions. `run_benchmark` already works exactly that way: it returns a
job id, and the agent passes that id to `get_run_status`. No transport-level
session is ever involved.

**One assumption to know about.** The job registry in `src/tools/harness.js` is
in-memory and assumes a single server process for the agent's lifetime. That
holds for stdio. It would **not** hold behind a stateless HTTP deployment with
more than one process, where a poll could land on a process that never started
the job. Anyone adding an HTTP transport must move that registry to shared
storage first.

**Why we have not upgraded.** The published TypeScript SDK does not speak the
new revision yet: `@modelcontextprotocol/sdk@1.30.0` is the only dist-tag on
npm and its `LATEST_PROTOCOL_VERSION` is `2025-11-25`. The dependency floor here
was raised to `^1.30.0` (from a stale `^1.12.1`, eighteen releases behind) so
installs resolve current. Re-check when a `2026-07-28`-capable SDK publishes;
the migration should be small given the table above.

## Data sources

The champollion.dev homepage map is an idealization of this data — agents
should read the sources, not the picture (the `champollion://network-data`
resource carries the full endpoint table).

- **Queue**: Fetched from `champollion.dev/queue.json` (tens of MB — it grows with coverage; cached 5 min in memory). Small slice: `champollion.dev/queue-preview.json`. For the live open-item count, call `get_project_info`
- **Mesh**: `champollion.dev/mesh.json` — the measured/registered pair network behind the homepage map
- **Corpus registry**: `champollion.dev/registry.json` — every registered eval corpus with license lane, attribution, checksum
- **Provider coverage**: `shared/catalogue/method-coverage.json` — each provider's published language list, cited + as-of + `tier` (the data behind the map's covered/uncovered split). The map's green has two tiers by exact ISO-639-3 code: bright = a deployed service lists it (Google/Microsoft/DeepL/LibreTranslate); dim = only an open research model lists it (NLLB/OPUS/M2M-100/MADLAD-400 — a model-card code, not a usable service)
- **Languages**: Loaded from `cli/shared/language-cards/` on startup (falls back to built-in index of 40 languages if the directory isn't accessible)
- **Results**: Read from the public Supabase leaderboard (`run_cards`) — the same anon read path the champollion.dev leaderboard uses. Scored aggregates and run-card metadata only; per-entry test sentences are never read. Override the project with `CHAMPOLLION_SUPABASE_URL` / `CHAMPOLLION_SUPABASE_ANON_KEY`.
- **Harness**: Shells out to `mt-eval` CLI (must be installed separately)
