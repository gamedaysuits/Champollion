---
title: MCP Server — the agent-facing door
sidebar_label: MCP Server
description: "Connect an AI agent to Champollion over the Model Context Protocol: 23 tools for translating, browsing the benchmark queue, running evaluations and training models — plus exactly which ones need more than an npx install."
---

# MCP Server — the agent-facing door

`champollion-mcp-server` exposes Champollion to AI agents over the [Model
Context Protocol](https://modelcontextprotocol.io). If you are an agent, or you
are wiring one up, this is the door: **23 tools, 3 resources and 3 prompts**
over stdio.

Everything here is also reachable as plain HTTP — see [Machine-readable
endpoints](#machine-readable-endpoints) — but the MCP server is the only surface
that lets an agent *act* (translate, run a benchmark, train a model) rather than
just read.

## Install

```bash
npx -y champollion-mcp-server
```

Then register it with your client. For Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

For clients configured by file (Claude Desktop, Cursor, Antigravity), add:

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

## Read this before you rely on it

**Nine of the 23 tools work from a bare `npx` install. The other fourteen need
software the npm package does not and cannot ship.** They do not fail silently —
each returns an actionable error naming what is missing — but you should know
the shape before you plan around it.

| Tools | Work after `npx`? | What else they need |
|---|---|---|
| `list_queue`, `get_queue_item`, `estimate_cost`, `search_languages`, `get_project_info`, `get_results`, `get_run_card`, `get_metric_reliability`, `get_training_guardrails` | **Yes** — read-only, served from public endpoints | nothing |
| `translate` | No | the `champollion` CLI (`npm i -g champollion`) and an API key |
| `run_benchmark`, `get_run_status` | No | the eval harness — `pipx install mt-eval-harness` |
| the eleven `forge_*` tools | No | a clone of the monorepo with `CHAMPOLLION_FORGE_DIR` set to its `forge/` directory; scoring also needs `mt-eval` |

If you want the whole surface, clone the repo rather than relying on `npx`.

## What the tools do

**Browse and cost the work.** `list_queue` and `get_queue_item` walk the open
benchmark queue — the ranked list of measurements that would most improve the
map. `estimate_cost` prices a set of runs before you spend anything.

**Look things up.** `search_languages` searches the language cards by name,
code, family or region. `get_results` and `get_run_card` read scored runs off
the public leaderboard. `get_metric_reliability` answers the question most
agents get wrong — *which metric should I trust for this target language* —
from correlations with human judgments per language family.

**Act.** `translate` runs text through the tested pipeline, with Translation
Memory (repeats cost nothing) and a deterministic quality gate.
`run_benchmark` starts an evaluation and returns a **job id immediately**,
because real runs outlast any client timeout; you poll `get_run_status` with
that id.

**Train without fooling yourself.** `get_training_guardrails` returns the rules
extracted from real measured failures. The eleven `forge_*` tools run
[NMT Forge](/docs/network/getting-started/training-honestly) — `forge_status`
first and after every step, `forge_preflight` to see which gates a command will
hit before it refuses.

:::note[Spending is bounded by design]
`run_benchmark` **refuses an unbounded queue run.** You must pass exactly one
bound — `budget`, `top`, or a specific `item_id`. There is no "just run the
queue" call, because an agent that misunderstands the queue could otherwise
spend without limit.
:::

## Protocol version

Transport is **stdio only** — one server process per agent.

MCP's [2026-07-28 revision](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
made the protocol stateless by default, retiring the `initialize` handshake and
the `Mcp-Session-Id` header. This server is unaffected in design: it uses none
of the deprecated capabilities (Roots, Sampling, Logging), never used the legacy
HTTP+SSE transport, and already follows the new guidance for cross-call state —
`run_benchmark` mints an explicit job handle that the model passes back, rather
than leaning on a transport session.

It has **not** been upgraded to the new revision, because no published
TypeScript SDK speaks it yet. See the [server
README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) for
the full position.

## Machine-readable endpoints

No MCP client needed for these:

| Endpoint | What it is |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | The [agent front door](/for-agents), as raw markdown |
| [`/llms.txt`](https://champollion.dev/llms.txt) | The curated index of this site |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Every indexed page, inlined |
| [`/queue.json`](https://champollion.dev/queue.json) | The full benchmark queue |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Top queue items |
| [`/registry.json`](https://champollion.dev/registry.json) | The corpus registry |
| [`/mesh.json`](https://champollion.dev/mesh.json) | The measured language graph |

## Next

- [Agent Guide — building & benchmarking](/docs/network/getting-started/agent-guide)
- [Agent Guide — translating with the CLI](/docs/guides/agent-guide)
- [Submit a Method](/docs/network/getting-started/submit-a-method)
