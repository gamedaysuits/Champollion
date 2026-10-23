---
title: Start a project
slug: /start
description: "Start building a translator for your language — with an AI assistant on your computer, or by typing four commands yourself."
---

# Start a project

There are two ways to start. Either way, the tools run on your own computer,
and they take you one step at a time.

## With an AI assistant

This is the easiest way. Your assistant does the typing; you answer the
questions that are yours to answer.

**What you need:** an AI assistant that runs as an app on your computer — not
just a phone app — and can use tools there.

### 1. Add the rails to your assistant

Copy the short setting below, paste it into your assistant, and say:
*"Please set this up for me."* Many assistants can. If yours can't, ask
someone who's handy with computers to do it once — the steps are just below.

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

<details>
<summary>Setting it up by hand</summary>

Assistants connect to tools through a common standard called MCP; the setting
above tells yours how to start the rails. Your computer also needs Node.js
20.11 or newer, a free program.

- **Claude's desktop app:** Settings → Developer → Edit Config. Add the
  setting to that file, save it, and restart the app.
- **Claude Code:** run this once in a terminal:
  `claude mcp add champollion -- npx -y champollion-mcp-server`
- **Cursor:** add the setting to the `mcp.json` file in your project's
  `.cursor` folder, or in the `.cursor` folder in your home folder.

</details>

### 2. Tell it, in your own words

Something like:

> *We want to build a translator from English to our language — use
> champollion.*

### 3. Answer what it asks

First, it will say the direction back to you — *"you put English in, and your
language comes out. Is that the way round you want?"* — because getting that
backwards is an easy mistake. Then it makes a project folder and asks for your
files.

From then on, it asks whenever a decision is yours: who your words belong to,
whether a translator may learn from them, whether to install something. Answer
for yourself. If you don't know yet, say so — the rails can wait. And *not
now* is always an answer: the rails won't ask again that session.

**One thing to know first.** Most assistants send what they read to the company
that runs them. For files kept on this computer, the tools only tell yours
*how many* sentences you have, never the sentences — but an assistant that can
use your computer can open any file you can. For words you want kept private,
ask it not to, or use an assistant that runs on your own computer. [Your words, your rules](/docs/your-words-your-rules) explains.

## On your own

If you're comfortable typing commands, it's four lines. Install the project
tool (it needs Node.js 20.11 or newer), start a project, and ask what's next:

```bash
npm install -g champollion
champollion new family --from English --to qaa --target-name "Our language"
cd family
champollion next
```

`qaa` means "a language without a code yet" — it works fine; the tools just
won't fill in facts like your alphabet for you. The name in quotes is what
you'll call it. If your language has a code, or a name the tools know,
use that instead. If a name could mean more than one language, ask your
speakers which one they speak before you choose a code; until they say, `qaa`
works, but it has no language card, so no plural rules or script come from one.

From then on, `champollion next` always names the next step and the exact
command for it. When it's time to teach a translator, the rails ask before
installing the training tools.

## Working without the internet

Stay online through the install and your first training: the training tools,
and the stronger translator (about 1.2 GB), download then. After that, the
work happens on your computer. To stop the tools' own lookups — they may fetch a language's public
information card, sending only the language's code — set this in your
terminal and in your assistant's settings:

```bash
export CHAMPOLLION_OFFLINE=1
```

An AI assistant that runs on a company's computers still needs the internet.
For fully offline work, use one that runs on your own computer.

## What to expect

Your first translator will probably be a phrasebook: good with sentences like
the ones it learned from, and not much else yet. That's where every project
starts. [What it can't do yet](/docs/what-it-cant-do-yet) says plainly what to
expect, and [Make it better](/docs/make-it-better) shows how it grows.

**Next:** [Bring what you have →](/docs/bring-your-data)

## Go deeper

- [Driving the rails over MCP](/docs/agents/mcp) — the six tools, the loop,
  and per-assistant setup in detail.
- [Driving the rails from the shell](/docs/agents/shell) — every command the
  rails run.
- [The operating contract](/docs/agents/contract) — the rules your assistant
  follows.
- [Who may use this](/docs/getting-started/who-may-use-this) — the licence.
