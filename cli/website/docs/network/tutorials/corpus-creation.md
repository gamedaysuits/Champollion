---
sidebar_position: 11
title: "Cookbook: Corpus Creation"
---

# Corpus Creation Guide

> **The idea:** Before you can evaluate a translation method, you need an evaluation corpus. This guide covers how to build one from scratch — data sourcing, format requirements, quality standards, licensing, and contributing to the Network.

:::info[This is not a translation method]
This guide is the prerequisite for many methods. A good evaluation corpus is the foundation that makes everything else possible. Even 50 curated pairs are enough to open a new leaderboard track.
:::

## When to Use This

- You want to **add a new language pair** to the Network leaderboard
- You're a **language teacher** who wants to benchmark student translations
- You're a **community language worker** with access to bilingual materials
- You're a **researcher** who needs a standardized evaluation set for your language pair

## Corpus Format

The harness takes simple JSON:

```json title="my-corpus.json"
{
  "metadata": {
    "name": "Quechua Dev v1",
    "version": "1.0.0",
    "source_language": "eng",
    "target_language": "que",
    "entry_count": 75,
    "license": "CC-BY-SA-4.0",
    "author": "Your Name / Organization",
    "description": "75 English-Quechua pairs from educational materials"
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello, how are you?",
      "reference": "Allillanchu, imaynallan kashanki?"
    },
    {
      "id": 2,
      "source": "The sun is shining today",
      "reference": "Kunan p'unchay inti k'anchashan"
    }
  ]
}
```

## Where to Source Data

| Source | Quality | Volume | Licensing |
|--------|---------|--------|-----------|
| **Textbooks / educational materials** | High (expert-reviewed) | Low-medium | Check with publisher |
| **Government documents** | Medium (formal register) | Medium-high | Often public domain |
| **Bilingual dictionaries** | High (verified entries) | Medium | Varies |
| **Community elders / speakers** | Highest (native intuition) | Low (limited time) | Community-governed |
| **Religious texts** | Medium (domain-specific) | High | Usually open |
| **Existing corpora** (Hansard, FLORES) | Medium-high | High | Check license |
| **Hand-crafted** | Highest | Low | You own it |

## Quality Standards

A good evaluation corpus has:

1. **Diverse content** — not just greetings or simple phrases. Include questions, commands, complex sentences, domain-specific terms
2. **Verified translations** — reviewed by at least one fluent speaker, ideally two
3. **Consistent orthography** — one script, one spelling convention throughout
4. **Independent sources** — not derived from the same text that methods will train on
5. **Clear licensing** — explicit license that allows evaluation use

:::danger[Corpus contamination]
The evaluation corpus must be **independent** of any training data. If a method was trained or prompted with data from the evaluation corpus, it will be disqualified. Design your corpus to be held-out from day one.
:::

## Size Guidelines

| Size | What It Enables |
|------|----------------|
| **50 entries** | Minimal viable evaluation — enough to detect gross quality differences |
| **100–200 entries** | Reliable ranking — enough for statistical significance between methods |
| **500+ entries** | Research-grade — robust composite scores, confidence intervals |
| **1,000+ entries** | Gold standard — equivalent to FLORES devtest coverage |

Start small. 50 entries is enough to open a leaderboard track. You can expand later.

## Contributing to the Network

1. **Create your corpus** in the JSON format above
2. **License it** — CC BY-SA 4.0 is recommended for open evaluation; CC BY-NC-SA 4.0 for restricted use
3. **Host it at a stable source** (your own repository, an institutional archive, or a data registry) — Champollion never hosts or tracks corpus content
4. **Submit a fetch-from-source metadata card** — open a PR against the [public repo](https://github.com/gamedaysuits/Champollion) adding a registry entry that points the harness at your upstream source (loader/URL, SHA pin, license, provenance); see [Datasets](/docs/network/leaderboard/datasets#creating-a-new-dataset) for the card format
5. **The leaderboard opens** for your language pair once the card is merged

## For Indigenous Language Communities

Corpus creation is an act of **language sovereignty**. Your corpus, your terms:

- You decide the license and access conditions
- You can contribute a **public development set** (for method development) while keeping a **secret test set** (for official evaluation) under community control
- The [sovereignty framework](/docs/network/sovereignty/data-sovereignty) protects your data at every level

Even a small corpus is a **strategic asset** — it's the benchmark that decides what "good enough" means for your language.

## Combines Well With

- **[Partial Translation](./partial-translation)** — creating a corpus IS the human translation step
- **[Back-Translation](./back-translation)** — synthetic data supplements human-created corpora
- Every other cookbook — they all need an evaluation corpus

## See Also

- [Evaluation Datasets](/docs/network/leaderboard/datasets) — existing corpora (EDTeKLA, FLORES+)
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — ownership and control
- [For Language Communities](/docs/network/community/for-language-communities) — community engagement
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — the big picture
