---
sidebar_position: 1
title: For Language Communities
---

# For Language Communities

> **Executive Summary.** Your community can own its own test set — the "answer key" every translation method is measured against — and run its own contest on its own terms, without ever handing the data over. This page explains what the Network asks of language communities (reference translations, translation review, coaching data), what you get back (paid work at published rates, code ownership, full deployment control), and the sovereignty guarantees that come first. No programming is required, and nothing here requires trusting us: the guarantees are structural, not promises.

You don't need to be a programmer to contribute to the Network. If you speak an Indigenous or low-resource language, you are the most important person in this ecosystem.

---

## Sovereignty Comes First

Before we ask anything of you, the ground rule: **your language data is yours.** Language data is *biodata* — it carries your community's identity and relationships and can't be meaningfully anonymized — so the people who provide it hold the keys to it, and to anything measured against it. The Network is built on [Indigenous data-sovereignty principles](/docs/network/sovereignty/data-sovereignty):

- We never collect or store your linguistic data on our servers
- Translation methods use the `api` architecture — all coaching data, dictionaries, and grammar rules stay on infrastructure you control
- You decide who can develop methods for your language
- Leaderboard scores prove a method works; they do not grant permission to deploy it

:::note[Where this stands today]
The ownership-transfer model described below is a **committed design, not yet a running program.** The leaderboard is open for submissions and currently has no published runs, and no method has transferred to a community yet. We describe how it is built to work so you can hold us to it — not to suggest it is already in motion. The relationship, and your authority over your data, come first; the rest follows from there.
:::

---

## Own Your Test Set

The strongest position a community can hold in this system is **owning the
benchmark itself**. A test set is the answer key: whoever holds it decides
what "good translation" means for the language, and every method — ours,
a corporation's, anyone's — is measured against *your* standard.

- **Registration is metadata, not content.** Registering a corpus with the
  Network means publishing a descriptive card — never uploading the corpus.
  You choose its [exposure lane](/docs/network/sovereignty/registering-corpora):
  open, gated, or fully sovereign.
- **Sovereign benchmarks stay secret.** In the sovereign lane, the test set
  never leaves community infrastructure and we never see it. Methods are
  scored against it on your side; only the score travels.
- **You can run your own contest.** The step-by-step runbook —
  [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest)
  — walks through hosting a community-controlled evaluation on your own
  terms: your test set, your rules, your decision about what (if anything)
  gets published.

The guarantees behind all of this are written down, not implied:
[Data Stewardship](/docs/network/sovereignty/data-sovereignty) (the data-sovereignty/CARE
position and what it forbids us from doing) and
[Ownership & Terms](/docs/network/sovereignty/ownership-transfer) (what
happens, contractually, when a method wins).

---

## What We Need From You

### Reference translations

We need curated translation pairs for evaluation — English on one side, your language on the other. These become the "answer key" that all translation methods are scored against.

You might create these from:
- **Educational materials** — textbook exercises, lesson plans, worksheets
- **Community documents** — meeting minutes, newsletters, announcements
- **Everyday phrases** — UI strings, app labels, common expressions
- **Cultural content** — stories, songs, or descriptions (with appropriate permissions)

The format is simple JSON:
```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

### Translation review

Every method that claims to produce working translations needs human validation. Bilingual speakers review outputs and tell us whether the computer got it right — and more importantly, *why* it got it wrong.

### Coaching data

Grammar rules, dictionary entries, morphological patterns — these are the linguistic resources that make translation methods work. Your knowledge of how your language works is irreplaceable by any AI model.

---

## What You Get Back

### Ownership

When a translation method is built for your language and validated on the Network, the [ownership transfers](/docs/network/sovereignty/ownership-transfer) to your community's governance organization. You own the code, the model weights, and the deployment.

### Paid work, not extraction

Corpus building and translation review are professional work, paid at
[published rates](/docs/network/perspectives/how-speakers-get-paid) — and
payment does not buy your data. You are paid for the work *and* remain the
owner of what you build. Champollion is a non-commercial research project: it
sells nothing, meters nothing, and [takes no share](/docs/network/sovereignty/economic-model)
of anything your community ever earns from a method it owns.

### Control

Your governance organization controls:
- Who can access the method
- Whether it can be used commercially — and if so, on your terms, keeping everything it earns
- When and how it gets updated
- What data is used for further development

---

## How To Get Involved

:::tip[Something speakers can do today]
Champollion does not build or host corpora — test data is always fetched
from its source. If speakers in your community want to contribute sentences
*right now*, [Tatoeba](https://tatoeba.org) accepts sentence-by-sentence
contributions in any language, and open collections like
[OPUS](https://opus.nlpl.eu/) aggregate parallel text the Network builds
benchmarks from. Sentences added there can become evaluation data here at
the next corpus build. A direct speaker-contribution app and corpus builder
are the planned next step on our roadmap.
:::

1. **Reach out** — Open an issue on the [Network repository](https://github.com/gamedaysuits/Champollion) or email [info@champollion.dev](mailto:info@champollion.dev)
2. **Describe your language** — What family is it in? How many speakers? What writing systems are used? What computational resources exist (FSTs, dictionaries, corpora)?
3. **Start small** — Even 50 curated translation pairs are enough to create an evaluation dataset and open a new leaderboard track. Corpus work is [paid at published rates](/docs/network/perspectives/how-speakers-get-paid)
4. **Keep it yours** — Register the corpus as metadata in the lane you choose ([Registering Corpora](/docs/network/sovereignty/registering-corpora)); if you want the test set fully secret, the [sovereign contest runbook](/docs/network/sovereignty/run-a-sovereign-contest) is the path
5. **Connect us to governance** — Who in your community has authority over language data and technology? The Network's sovereignty model requires a governance partner

---

## See Also

- [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) — the runbook for a community-controlled evaluation
- [Terms Templates](/docs/network/sovereignty/terms-templates) — legally simple, trustless-leaning terms your community can adapt, with the trojan-horse risks spelled out
- [Data Stewardship](/docs/network/sovereignty/data-sovereignty) — the position, and the frameworks (CARE, Te Mana Raraunga, and other Indigenous data-sovereignty instruments) that shaped it
- [Ownership & Terms](/docs/network/sovereignty/ownership-transfer) — per-language terms and what happens when a method wins
- [How the Work Is Funded](/docs/network/sovereignty/economic-model) — where money moves in a non-commercial project
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — technical context for researchers working alongside communities

