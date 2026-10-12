---
sidebar_position: 5
title: 'Deploy to Production'
description: 'Take a proven method from the Network and deploy it via champollion.'
---

# Deploy to Production

You proved it works in the Network. Now deploy it.

The Network is for R&D — building, benchmarking, and comparing translation methods. **Production deployment** happens through [champollion](https://champollion.dev), the developer-facing translation CLI. They connect through a shared plugin format.

```mermaid
graph LR
    A["Network\n(benchmark)"] -->|"method.json\n+ coaching data"| B["champollion\n(production)"]
    B -->|"Speaker feedback\nimproves the method"| A
```

---

## The Deployment Path

### 1. Export Your Method as a Plugin

Create a `method.json` manifest that packages your benchmark results:

```json
{
  "name": "french-formal-v1",
  "type": "llm-coached",
  "version": "1.0.0",
  "description": "Formal-register French (example manifest; the benchmark values are illustrative)",
  "locales": ["fr"],
  "config": {
    "model": "google/gemini-2.5-flash",
    "temperature": 0.3
  },
  "benchmarks": {
    "fr": {
      "corpus_chrf": 72.3,
      "exact_match_rate": 0.42,
      "corpus_size": 500
    }
  }
}
```

Include any coaching data (grammar rules, dictionaries) alongside the manifest.

### 2. Install in Champollion

```bash
champollion plugin install ./french-formal-v1/
```

### 3. Configure Your Pair

```json title="champollion.config.json"
{
  "pairs": {
    "en:fr": { "methodPlugin": "french-formal-v1" }
  }
}
```

### 4. Translate Real Content

```bash
npx champollion sync
```

Your benchmarked method is now producing real translations in production.

---

## For Indigenous Languages

Methods serving Indigenous language communities require **community consent** before production deployment. Indigenous data-sovereignty principles — community ownership and control of language data — govern how translation methods are developed, evaluated, and deployed.

No score makes a method deployable — not a high chrF++, and not a prize threshold. It deploys **if and when** the language community's governance body gives consent, after speakers of the language have judged its output.

See [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) and [Ownership Transfer](/docs/network/sovereignty/ownership-transfer) for the full governance framework.

---

## See Also

- [The Eval Harness Bridge](https://champollion.dev/docs/guides/bridge) — detailed walkthrough of the Network→champollion pipeline
- [Plugin Specification](https://champollion.dev/docs/reference/plugin-spec) — the method.json manifest format
- [champollion Agent Guide](https://champollion.dev/docs/guides/agent-guide) — how to use champollion for translation

