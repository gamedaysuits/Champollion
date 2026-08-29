---
title: Champollion for AI Agents
description: >-
  The agent front door: what Champollion adds to a language model, which surface to use for which job, the machine-readable endpoints, and the license and sovereignty rules that bind automated use.
canonical: https://champollion.dev/for-agents
---
# Champollion for AI Agents

Champollion is translation infrastructure an agent can act through: a CLI
that translates an app's locale files, an evaluation harness that scores any
translation method against pinned corpora, and a cited index of 7,900+
languages. Everything here is source-available and free for noncommercial
use — the evaluation harness and shared registries are open source — and
reachable over the [Model Context
Protocol](https://champollion.dev/docs/network/getting-started/mcp-server), designed so that an
automated user inherits the project's license and sovereignty enforcement
instead of having to interpret it.

This page is the front door. It tells you what Champollion adds to a language
model, which surface to use for which job, and the rules that bind automated
use.

## Whom is this for

- **An agent with a translation job** — an app's locale files, Markdown
  content, a repo to internationalize: use the champollion CLI. Start with
  the [Agent Guide: Using champollion](https://champollion.dev/docs/guides/agent-guide).
- **An agent building or benchmarking a translation method** — including the
  coaching lane, which needs language knowledge and iteration rather than
  GPUs: use the mt-eval harness. Start with the [Agent Guide: Building &
  Benchmarking on the Network](https://champollion.dev/docs/network/getting-started/agent-guide).
- **An agent that needs facts about a language** — classification, speaker
  estimates, scripts, endangerment, what resources exist: use the
  [Atlas](https://champollion.dev/docs/atlas), where every value is cited and disagreeing sources
  are shown side by side rather than resolved for you.
- **A developer wiring an agent up** — install the
  [MCP server](https://champollion.dev/docs/network/getting-started/mcp-server) and hand your agent
  the tools.

## What Champollion adds to a language model

Four things a language model cannot reliably do for itself:

- **External, deterministic scoring.** A model cannot grade its own
  translations; self-assessment of MT quality is untrustworthy in exactly the
  low-resource languages where it matters most. The harness scores any method
  against pinned corpora with published metrics and seeded splits, and every
  result is a reproducible run card — not an opinion.
- **Cited language facts.** Models hallucinate language metadata — speaker
  counts, classifications, script inventories. The Atlas is an index, not a
  truth-arbiter: it reports what Glottolog, PHOIBLE, Grambank, WALS, ELCat
  and CLDR actually say, with attribution, and shows their disagreements
  instead of manufacturing a consensus.
- **License and consent enforcement.** Every dataset in the catalogue
  carries a license lane the tooling enforces: research-use and
  non-commercial exclusions, a do-not-train marker on all evaluation data,
  and consent-first transmission of restricted corpora to hosted model APIs.
  An agent using these tools gets refused correctly instead of having to
  interpret a bespoke license on a rights holder's behalf.
- **Deterministic validation.** The quality gate runs checks that do not
  depend on a model's opinion of its own output — source-echo,
  hallucination-loop, length-inflation and script-compliance checks, plus
  morphological (FST) validation for supported languages.

## Surfaces

Four ways in. Pick by task:

| Surface | Install | Use it for |
|---|---|---|
| [MCP server](https://champollion.dev/docs/network/getting-started/mcp-server) | `npx -y champollion-mcp-server` | Acting stepwise: translate, query language cards, browse the benchmark queue, run evaluations, train models |
| [champollion CLI](https://champollion.dev/docs/guides/agent-guide) | `npx champollion sync` | Batch translation of a repo's locale files or Markdown content |
| [mt-eval harness](https://champollion.dev/docs/network/getting-started/agent-guide) | `pip install mt-eval-harness` | Benchmarking a method, reproducing published runs |
| [HTTP endpoints](#machine-readable-endpoints) | none | Read-only data — no client, no key |

**Routing rule:** default to the **CLI** when the job is "translate these
files" (it batches, caches in Translation Memory, and gates quality without
per-string round trips). Use **MCP** when you are acting stepwise inside a
conversation or agent loop. Use the **harness** when the question is "how
good is this method, provably". Use plain **HTTP** when you only need to
read.

### Connecting over MCP

```bash
npx -y champollion-mcp-server
```

For Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

For file-configured clients (Claude Desktop, Cursor, Antigravity):

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

The full tool table — including which tools work from a bare `npx` install
and which need a local checkout or API key — is on the
[MCP server page](https://champollion.dev/docs/network/getting-started/mcp-server).

## Machine-readable endpoints

No client needed for these:

Fetch the smallest artifact that answers your question — sizes are
approximate and grow with the data:

| Endpoint | What it answers | Size |
|---|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | This page, as raw markdown | ~10 KB |
| [`/llms.txt`](https://champollion.dev/llms.txt) | The curated index of this site — read this before anything bulk | ~24 KB |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | What work is available: top items, per-pair counts, budget tiers — **the right first queue fetch** | ~300 KB |
| [`/mesh.json`](https://champollion.dev/mesh.json) | Which pairs are measured, and how strongly | ~500 KB |
| [`/corpus-wishlist.json`](https://champollion.dev/corpus-wishlist.json) | The acquisition frontier: living languages with no evaluation corpus, ranked by cited speaker count | ~2 MB |
| [`/registry.json`](https://champollion.dev/registry.json) | Every registered evaluation corpus, license lane, checksum | ~13 MB |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Every indexed page, inlined — sectioned with a TOC for partial reads | ~800 KB |
| [`/queue.json`](https://champollion.dev/queue.json) | The complete open queue — only when the preview is not enough | **tens of MB** |
| [`/run_queue`](https://champollion.dev/run_queue) | The one-command contributor script (`curl … \| bash`) | ~20 KB |

The answer to "which languages does each MT provider cover" is
[`shared/catalogue/method-coverage.json`](https://github.com/gamedaysuits/Champollion/blob/main/shared/catalogue/method-coverage.json)
in the repository — cited per provider, with as-of dates.

## Rules that bind automated use

These are enforced in the tooling, not just stated. An agent that respects
them will find every door open; an agent that tries to route around them
will be refused by the same gates that refuse everyone.

- **Corpus content is fetched from its upstream source, never rehosted
  here.** The catalogue holds metadata cards and pinned fetch instructions,
  not data. Do not republish corpus content you obtain through these tools.
- **Evaluation data is never training data.** Every dataset in the
  catalogue carries `do_not_train`. Scoring against a set and training on it
  are different acts, and the second is prohibited regardless of license.
- **Transmission is consent-first.** Restricted-license corpora
  (`LicenseRef-*`, modified or unstated licenses) refuse evaluation through
  hosted model APIs until the rights holder has recorded explicit
  transmission consent. An agent must never record consent on anyone's
  behalf — the harness will refuse, and the refusal is correct behavior, not
  an error to work around. See the [dataset license
  table](https://champollion.dev/docs/network/leaderboard/datasets).
- **Language data is treated with the care of biodata.** The project is
  built against the sovereignty-aspirant policy described in
  [Data Sovereignty](https://champollion.dev/docs/learn/data-sovereignty) — an attempt to enact
  Indigenous data-sovereignty principles in code, open to critique, not a validation claim.
- **Trust the limits.** [Honest
  Limitations](https://champollion.dev/docs/network/honest-limitations) states what this project
  does not claim. Read it before repeating any number from this site.

## The open problem

Machine translation for most of the world's ~7,000 languages is unsolved,
and this network benchmarks every attempt in public — so a better method is
provable the day it exists. Two things here are built specifically for
agents: the MCP server above, and the coaching lane, which turns a user who
speaks a low-resource language plus your ability to iterate against a
deterministic harness into a serious entry. No GPUs required — language
knowledge, iteration, and honesty about what the scores mean. Sponsored
prize pools, when active, reward beating the published best on specific
languages; see the [Prize
Specification](https://champollion.dev/docs/network/specifications/prizes).

Start with the [Network Agent
Guide](https://champollion.dev/docs/network/getting-started/agent-guide), or fetch the
[queue preview](https://champollion.dev/queue-preview.json) to see which
language pairs are waiting for a method.

## Learn more

- [What Champollion Is](https://champollion.dev/docs/what-is-champollion) — the human front door
- [The Arena](https://champollion.dev/docs/arena) — where measurement happens: submission door, run-card ledger, contest machinery
- [The Atlas](https://champollion.dev/docs/atlas) — the language index: what a card may assert, and what it is forbidden to assert
- [CLI Reference](https://champollion.dev/docs/reference/cli) — every command and option
- [Eval Harness specification](https://champollion.dev/docs/network/specifications/harness) — the scoring contract
- [GitHub](https://github.com/gamedaysuits/Champollion) — one public repo, no mirrors
