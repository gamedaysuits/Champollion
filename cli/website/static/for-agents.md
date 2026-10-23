---
title: Champollion for AI Agents
description: >-
  The agent front door: what Champollion adds to a language model, which surface to use for which job, the machine-readable endpoints, and the license and sovereignty rules that bind automated use.
canonical: https://champollion.dev/for-agents
---
# Champollion for AI Agents

**Read [the operating contract](https://champollion.dev/docs/agents/contract) first.** You are an
outside AI service unless your model runs on the person's computer: what you
read goes to your model provider. Never open, print or summarize the person's
data files, test sentences, word lists or review sheets — bring files in with
`add_data` (or `champollion data add`), which reports counts and columns
only. Never answer a question that is the people's to answer, never record a
consent, and never loosen a file's terms. The contract says which of these
rules the tools enforce and which only you can keep; every project the rails
create carries it as `AGENTS.md`.

Champollion is **machine translation development and deployment on rails with
guardrails** — built with low-resource and Indigenous language communities in
mind. If a person says *"we want to build a translator for our language — use
champollion"*, add the MCP server (below) and call `start_project`. Its first
call makes nothing: it gives you the direction to say back to the person.
From then on, `project_status` names THE next step from the project's files,
with the exact tool call; hand every question it marks as the person's back
to them.

Behind the rails: an evaluation harness that scores any translation method
against any test set, a training suite with guardrails (NMT Forge), a cited
index of what is known about each language (the Atlas), sealed tests on test
sets their holders keep, and a CLI that puts a proven model to work — in a
translation service, an app, or a website's language files. The CLI, MCP
server and NMT Forge are source-available and free for noncommercial use; the
evaluation harness and shared registries are open source. The rails promise
process, not quality: they tell the person how good a model is, never that it
is good.

## Whom is this for

- **An agent asked to build translation for a language** — follow the rails:
  [Driving the rails over MCP](https://champollion.dev/docs/agents/mcp), or
  [from the shell](https://champollion.dev/docs/agents/shell). The first command is
  `npx champollion new <folder> --from English --to <language>`; a language
  with no standard code is `--to qaa --target-name "<its name>"` (over MCP,
  `start_project` with `target_name`). The full manual is at
  [/docs/agents](https://champollion.dev/docs/agents); the rules are in
  [the contract](https://champollion.dev/docs/agents/contract).
- **An agent with a translation job** — an app's locale files, Markdown
  content, a repo to internationalize: use `champollion sync`. Start with
  [Serving and deployment](https://champollion.dev/docs/agents/serving) and the
  [app and site reference](https://champollion.dev/docs/intro).
- **An agent building or benchmarking a translation method**: use the mt-eval
  harness. Start with [Measurement rules](https://champollion.dev/docs/agents/measurement) and
  [Methods and gates](https://champollion.dev/docs/agents/methods).
- **An agent that needs facts about a language** — classification, speaker
  estimates, scripts, endangerment, what resources exist: use the
  [Atlas](https://champollion.dev/docs/atlas), where every value is cited and disagreeing sources
  are shown side by side rather than resolved for you.
- **A developer wiring an agent up** — install the
  [MCP server](https://champollion.dev/docs/network/getting-started/mcp-server) and hand your agent
  the tools.

This page is the front door. It tells you what Champollion adds to a language
model, which surface to use for which job, and the rules that bind automated
use.

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
| [MCP server](https://champollion.dev/docs/network/getting-started/mcp-server) | `npx -y champollion-mcp-server` | Building MT for a language on the rails (the default profile); `--profile full` for every tool — language cards, the benchmark queue, evaluations, training |
| [champollion CLI](https://champollion.dev/docs/agents/serving) | `npx champollion sync` | Batch translation of a repo's locale files or Markdown content |
| [mt-eval harness](https://champollion.dev/docs/agents/measurement) | `python3 -m pip install mt-eval-harness` | Benchmarking a method, reproducing published runs |
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

That starts the **rails profile**: six tools (`start_project`,
`project_status`, `run_next_step`, `add_data`, `try_translation`, `explain`)
that walk one language project end to end. For every tool, start it with
`--profile full`:

```bash
npx -y champollion-mcp-server --profile full
```

The full tool table — including which tools work from a bare `npx` install
and which need a local checkout or API key — is on the
[MCP server page](https://champollion.dev/docs/network/getting-started/mcp-server).

If your host asks before each tool, the tools say what they do in their MCP
annotations: `preview_publish` shows exactly what a publish would send and
can never publish (`readOnlyHint`), so it is safe to allow on its own;
`publish_report` is the real, public write (`destructiveHint`,
`openWorldHint`) and needs the user's yes.

When a tool returns a score with `score_caveats` (mt-eval's own reading of
that run, relayed verbatim by nmt-forge as well), show the caveat with the
score, every time. A major one, such as *near-constant output* (many
different sentences got the same few translations), means the number does
not describe translation, whatever its size.

## Machine-readable endpoints

No client needed for these:

Fetch the smallest artifact that answers your question — sizes are
approximate and grow with the data:

| Endpoint | What it answers | Size |
|---|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | This page, as raw markdown | ~14 KB |
| [`/llms.txt`](https://champollion.dev/llms.txt) | The curated index of this site — read this before anything bulk | ~17 KB |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | What work is available: top items, per-pair counts, budget tiers — **the right first queue fetch** | ~300 KB |
| [`/mesh.json`](https://champollion.dev/mesh.json) | Which pairs are measured, and how strongly | ~500 KB |
| [`/corpus-wishlist.json`](https://champollion.dev/corpus-wishlist.json) | The acquisition frontier: living languages with no evaluation corpus, ranked by cited speaker count | ~2 MB |
| [`/registry.json`](https://champollion.dev/registry.json) | Every registered evaluation corpus, license lane, checksum | ~13 MB |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Every indexed page, inlined — sectioned with a TOC for partial reads | ~1 MB |
| [`/queue.json`](https://champollion.dev/queue.json) | The complete open queue — only when the preview is not enough | **tens of MB** |
| [`/run_queue`](https://champollion.dev/run_queue) | The one-command contributor script (`curl … \| bash`) | ~20 KB |

The answer to "which languages does each MT provider cover" is
[`shared/catalogue/method-coverage.json`](https://github.com/gamedaysuits/Champollion/blob/main/shared/catalogue/method-coverage.json)
in the repository — cited per provider, with as-of dates.

## Check the licence before you install

The CLI, the MCP server and NMT Forge are source-available under PolyForm
Noncommercial 1.0.0: free for noncommercial use only — personal and research
projects, schools, charities, public hospitals and clinics, government offices.
A business's product is commercial use and is not covered: tell your user so,
and do not install them for one. The evaluation harness is open source (AGPL).
[Who may use this](https://champollion.dev/docs/getting-started/who-may-use-this).

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
- **Trust the limits.** [Technical
  limits](https://champollion.dev/docs/network/honest-limitations) state what this project
  does not claim. Read it before repeating any number from this site.

## The open problem

Machine translation for most of the world's languages is unsolved. The rails
exist so that the people who hold a language can build and measure their own,
on their own terms; the leaderboard and sealed tests exist so that a better
method can be proven on test sets their holders keep. Sponsored prize pools,
when active, reward beating the published best on specific languages; see the
[Prize Specification](https://champollion.dev/docs/network/specifications/prizes) and
[Leaderboard and publishing](https://champollion.dev/docs/reference/leaderboard).

## Learn more

- [The operating contract](https://champollion.dev/docs/agents/contract) — read first
- [What this is](https://champollion.dev/docs/what-is-champollion) — the people's front door
- [Leaderboard and publishing](https://champollion.dev/docs/reference/leaderboard) — public and sealed benchmarks, and what a published run carries
- [The Atlas](https://champollion.dev/docs/atlas) — the language index: what a card may assert, and what it is forbidden to assert
- [CLI Reference](https://champollion.dev/docs/reference/cli) — every command and option
- [Eval Harness specification](https://champollion.dev/docs/network/specifications/harness) — the scoring contract
- [GitHub](https://github.com/gamedaysuits/Champollion) — one public repo, no mirrors
