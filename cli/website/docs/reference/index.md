---
title: Reference
slug: /reference
description: "Every technical detail in one map: the commands, the file formats, the specifications, the technical limits, hosting a sealed test, the leaderboard, app and site translation, the Atlas, and the network infrastructure."
---

# Reference

The complete technical record, for developers, researchers and AI agents.
The [people pages](/docs/) tell the same story in plain words, and
[the agents' manual](/docs/agents) says how an agent drives it; every page
below states it with full precision.

## Commands

- [`champollion`](/docs/reference/cli) — every command and flag of the project
  tool and the app-and-site translator.
- [`nmt-forge`](/docs/network/getting-started/forge-command-reference) — every
  command of the model-training suite, generated from its parser.
- [`mt-eval`](/docs/reference/mt-eval) — every command of the evaluation
  harness, generated from its parser.
- [The MCP server](/docs/network/getting-started/mcp-server) — both profiles,
  every tool and every argument.

## Formats

- [Framework formats](/docs/reference/formats) — project/1, set/1, method/1,
  gate-chain/1, deployment/1 and service-api/1, from their schemas.
- [Run card](/docs/network/specifications/run-card) — what a scored run
  records and publishes.
- [Coaching data](/docs/concepts/coaching-data) — the grammar notes and word
  lists an LLM method is given.
- [Plugin Specification](/docs/reference/plugin-spec) — the method plugin
  manifest (`method.json`) a translation method ships as.
- [Language card](/docs/reference/language-card-spec) — the schema of a card
  in the Atlas.

## Specifications

- [Scoring](/docs/network/specifications/scoring) — scoring standard/1: the
  corpus chrF++ headline with its 95% bootstrap interval, the standard metrics
  beside it, and the diagnostics kept apart.
- [Significance](/docs/network/specifications/significance) — paired tests,
  and when one run is better than another.
- [Method interface](/docs/network/specifications/methods) — what a method is,
  its classes and dependencies.
- [Metric reliability](/docs/network/specifications/metric-reliability) —
  which metric to trust for which kind of language, from human judgments.
- [Benchmark](/docs/network/specifications/benchmark) — the protocol every
  valid run follows.
- [Harness](/docs/network/specifications/harness) — how `mt-eval` runs,
  scores and publishes.
- [Speaker validation](/docs/network/specifications/speaker-validation) — the
  human review automatic scores stand in for.

## Technical limits

- [Technical limits](/docs/network/honest-limitations) — what is not claimed:
  self-reported trust tiers, no speaker review yet, sealed-test custody, and no
  per-sentence confidence.

## Hosting a sealed test

- [Run a sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest)
  — the end-to-end runbook for a test set that never leaves the host's machine.
- [Sovereign eval node](/docs/network/sovereignty/sovereign-eval-node) — the
  scoring machine: hardware, air gap and key ceremony.
- [Registering corpora](/docs/network/sovereignty/registering-corpora) —
  exposure tiers and licence lanes for a corpus you hold.
- [Ownership & terms](/docs/network/sovereignty/ownership-transfer) and
  [Terms templates](/docs/network/sovereignty/terms-templates) — what an entry
  hands over, declared before anyone enters.
- [Prizes](/docs/network/specifications/prizes) — what a prize requires, if a
  sponsor opens one.

## Leaderboard and publishing

- [Leaderboard and publishing](/docs/reference/leaderboard) — what the board
  is, the two kinds of benchmark, and what a published run carries.
- [Submission rules](/docs/network/leaderboard/rules) — what is accepted,
  what is disqualified, and the verification tiers.
- [Evaluation datasets](/docs/network/leaderboard/datasets) — the registered
  datasets and their licence lanes.
- [Submit a method](/docs/network/getting-started/submit-a-method) — run the
  harness and publish a run card.
- [Contributing compute](/docs/network/getting-started/contributing-compute) —
  run items off the public queue with your own key.
- [FAQ](/docs/network/getting-started/faq) — metrics, models, FSTs and
  disqualification.

## App and site translation

- [App and site translation](/docs/intro) — what `champollion sync` does, and
  a guide to every page about it: quick start, installation, configuration,
  frameworks, CI/CD, methods, content, translation memory, the quality gate,
  security, scripts, translators and troubleshooting.

## The Atlas

- [The Atlas](/docs/atlas) — what the language index is and where its facts
  come from.
- [Language card specification](/docs/reference/language-card-spec) and the
  [citation procedure](/docs/reference/language-card-citation-procedure) —
  every field, and how each is cited.
- [What counts as a language](/docs/network/context/what-counts-as-a-language)
  — the answers the index gives, and why.
- [Submit to the index](/docs/network/getting-started/submit-to-the-index) and
  [Reporting errors](/docs/network/perspectives/reporting-errors-and-owning-corrections)
  — proposing an entry or a correction.

## Network infrastructure

- [Queue construction](/docs/network/specifications/queue-construction) and
  [why the queue is built this way](/docs/network/perspectives/why-the-queue)
  — how the public work queue ranks what to measure next.
- [Connection strength](/docs/network/specifications/connection-strength) —
  what an arc on the network map says about a pair, and the strength ramp
  that was retired.
- [Contributing compute](/docs/network/getting-started/contributing-compute) —
  running the queue.
