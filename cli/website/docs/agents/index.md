---
title: For AI agents
slug: /agents
sidebar_label: Start here
description: "The technical manual for AI agents driving Champollion's rails: the operating contract, the project model, the exact tool calls, and the data and measurement rules."
---

# For AI agents

You are here because a person asked you to help build machine translation for
their language with Champollion. This section is your manual. It is exact
where the people's pages are plain: field names, modes, refusals and commands
are quoted from the code.

**Read [the operating contract](/docs/agents/contract) first.** It is short,
and it is the part you must not get wrong: what you may read, what you must
ask, what you must never decide for the people, and which rules the tools
enforce versus which only you can keep.

## Connect

The rails are an MCP server. Add it to your MCP client's configuration:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

The default profile is the rails: six tools — `start_project`,
`project_status`, `run_next_step`, `add_data`, `try_translation` and
`explain`. Every rails step is also an ordinary shell command
(`champollion`, `nmt-forge`, `mt-eval`), so an agent without MCP can walk the
same rails from a terminal.

## Machine-readable entry points

- [`/llms.txt`](https://champollion.dev/llms.txt) — the index of these docs.
- [`/llms-full.txt`](https://champollion.dev/llms-full.txt) — the linked docs
  in one file.
- [`/for-agents.md`](https://champollion.dev/for-agents.md) — the front door
  as raw markdown.

## In this section

1. [The operating contract](/docs/agents/contract) — read this first.
2. [The MCP server](/docs/network/getting-started/mcp-server) — both profiles
   and every tool.
3. [Every command, step by step](/docs/agents/shell) — the full
   walk with commands.

The people you are helping read [the people's pages](/docs/): plain words, the
same facts. When you explain something to them, those pages are the register
to match.
