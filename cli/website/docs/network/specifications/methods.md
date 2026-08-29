---
sidebar_position: 4
title: Method Interface
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Put this interface on the leaderboard"
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
    note: "A full method, built end-to-end"
---

# Shared Method Interface

> **Executive Summary.** This page specifies the `TranslationMethod` protocol that all Network methods must implement, the six method classes (`raw-llm`, `coached-llm`, `pipeline`, `custom-plugin`, `api`, `human`), the orthogonal **paradigm** axis (`rule-based`, `statistical`, `neural-nmt`, `llm`, `hybrid`, …) that makes *how a method translates* comparable across systems, the method plugin format, and the **dependency classes** (S/O/A1/A2/X) that determine whether a method can run in the evaluation sandbox and qualify for prizes. These are three independent axes. Any approach that implements this protocol can be benchmarked; what it depends on determines where it can compete.

The eval harness and champollion share a common concept of **translation method**. A method is any procedure that takes source text and produces translated text — whether it's a direct LLM call, a multi-stage pipeline, a third-party API, or a human translator.

## Architecture

```
Method Plugin (v2 Spec)
├── method.json           ← Manifest (name, class, entry_point, dependencies, metadata)
├── method_card.json      ← Leaderboard description (what, not how)
├── pipeline.py           ← Python module implementing TranslationMethod
└── (optional helpers)    ← Additional Python modules
```

Loaded via `--method path/to/dir`. The harness discovers nothing automatically.

## Two Systems, One Interface

| | Eval Harness | champollion |
|---|---|---|
| **Language** | Python | Node.js |
| **Entry point** | `translate.py` | `translate.js` |
| **Interface** | `TranslationMethod` protocol | `methodPlugin` config |
| **Purpose** | Batch evaluation with scoring | Live localization in dev/CI |
| **Output** | Run card with metrics | Translated locale files |

A method that supports both systems provides two entry points — one for each language runtime. The **method card** is the bridge: it describes the method in a format both systems understand.

## Method Card {#method-card}

A method card describes *what* a translation method is without revealing proprietary details like the full system prompt. It answers:

- What class of method is this? (raw LLM, coached LLM, pipeline, API, etc.)
- What **paradigm** does it use? (rule-based, statistical, neural-nmt, llm, hybrid)
- What tools does it use? (FST analyzer, dictionary, etc.)
- Is the implementation open source?
- What language pairs does it support?

See the [Method Card Spec](/docs/network/specifications/methods#method-card) for the full JSON schema.

### Example

```json
{
  "method_id": "fst-gated-v8",
  "name": "FST-Gated Coached Translation v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "description": "LLM translation with morphological validation. Failed words are retried with FST feedback.",
  "author": "Curtis Forbes",
  "tools_used": ["HFST morphological analyzer", "Wolvengrey dictionary"],
  "open_source": false,
  "dependency_class": "A2",
  "supported_pairs": ["eng>crk"]
}
```

The `dependency_class` field summarizes what the method needs to run and transfer — see [Method Validity and Dependency Classes](#method-validity-and-dependency-classes) below. The `paradigm` field places the method on the **paradigm axis** (here `hybrid`: an LLM gated by a rule-based FST) — see [Paradigms](#paradigms) below.

### Method Classes

| Class | Description |
|-------|-------------|
| `raw-llm` | Direct LLM call with minimal instruction |
| `coached-llm` | LLM with structured prompt, examples, constraints |
| `pipeline` | Multi-stage pipeline with deterministic components |
| `custom-plugin` | External process implementing the `TranslationMethod` protocol |
| `api` | Third-party translation API (Google Translate, DeepL, etc.) |
| `human` | Human translation (for establishing baselines) |

### Paradigms {#paradigms}

The **paradigm** is a third, independent axis: *how a method translates at the algorithmic level*. It is orthogonal to both method class and dependency class. Method class alone is LLM-centric — a rule-based [Apertium](https://www.apertium.org/) system and Google Translate both land in `pipeline`/`api`, so "rule-based vs neural" is invisible without it. The paradigm axis makes that comparison first-class and filterable on the leaderboard.

| Paradigm | Description | Examples |
|----------|-------------|----------|
| `rule-based` | Finite-state transducers, hand-written grammars, morphological transfer | Apertium, GiellaLT FST generation |
| `statistical` | Phrase-based / statistical MT (SMT) learned from parallel corpora | classic Moses |
| `neural-nmt` | A dedicated neural encoder–decoder MT model | Google Translate, DeepL, Microsoft Translator, OPUS-MT, LibreTranslate, Tilde MT, Translated (Lara) |
| `llm` | A general-purpose large language model prompted to translate | a raw or coached GPT / Claude / Gemini call |
| `hybrid` | Combines two or more paradigms in one method | an LLM gated by a rule-based FST (crk-translate); NMT + rule-based post-editing |
| `human` | Human translation (paradigm-level baseline) | community translator baseline |
| `unknown` | Unspecified — the card declared no paradigm | back-compat default for pre-paradigm cards |

The axes are independent. Some worked examples:

| Method | `class` | `paradigm` | `dependency_class` |
|--------|---------|-----------|--------------------|
| Google Translate | `api` | `neural-nmt` | A2 |
| Tilde MT / Translated (Lara) | `api` | `neural-nmt` | A2 |
| LibreTranslate (self-hosted, OSS) | `api` | `neural-nmt` | O |
| Apertium | `pipeline` | `rule-based` | O |
| crk-translate (FST-gated, LLM-coached) | `pipeline` | `hybrid` | A2 |
| Raw GPT call | `raw-llm` | `llm` | A1 |

The paradigm is **optional** on a method card; an absent paradigm is recorded as `unknown` (it never blocks publishing — the axis is additive). The enum above is the canonical, supported vocabulary, enforced by the harness (`config.VALID_PARADIGMS`). Because enforcement is app-side rather than a database constraint, new paradigms can be added later without a migration; only renaming or removing a value once methods rely on it is costly.

## Method Validity and Dependency Classes {#method-validity-and-dependency-classes}

A method is only as runnable, and only as transferable, as its least available dependency. Two Network mechanisms depend on knowing exactly what a method needs:

1. **Sandboxed evaluation** ([Benchmark Specification §8.2](/docs/network/specifications/benchmark)) — official gold-standard scores come from a sandbox whose network policy is **default-deny**. A method that silently requires an external service cannot produce an official score.
2. **Prize transfer** ([Prize Specification](/docs/network/specifications/prizes)) — prize-winning methods transfer to the language community's governance organization. A method that bundles content the submitter had no right to include cannot lawfully be transferred. The submitter must hold (or be granted) the rights to everything in the box.

To make both checks mechanical rather than ad hoc, every method declares a **dependency class**, derived from a **dependency manifest** in `method.json`.

> **Note on naming — three independent axes.** *Method class* (§above: `raw-llm`, `pipeline`, …) describes the *shape* of a method — the interface contract it presents. *Paradigm* ([§Paradigms](#paradigms): `rule-based`, `neural-nmt`, `llm`, …) describes *how it translates algorithmically*. *Dependency class* (this section) describes *what it needs to run and transfer*. The three are orthogonal: a `pipeline` method can be `rule-based` or `hybrid`, and can be any dependency class. (Class and paradigm are intentionally separate because class alone is LLM-centric — it cannot tell a rule-based system from a neural one when both present as a `pipeline` or `api`.)

### The Five Dependency Classes

| Class | Name | Definition | Sandbox-runnable? | Prize-eligible? |
|-------|------|-----------|-------------------|-----------------|
| **S** | Self-contained | All code, data, models, and weights ship inside the method directory, under licenses that permit redistribution and community transfer. | ✅ Yes, as-is | ✅ Yes |
| **O** | Open external | Depends on externally hosted artifacts under open licenses that permit redistribution (including copyleft licenses such as AGPL) — e.g., an FST downloaded at install time. | ✅ Yes — artifacts are pinned and **mirrored into the submission** | ✅ Yes, with license-compatibility conditions: copyleft terms are preserved through transfer, and the community receives the same rights the license grants everyone |
| **A1** | API-dependent, substitutable | Requires runtime LLM inference, where the model is **substitutable configuration** — any sufficiently capable model can be slotted in. The method's value lives in its prompts, coaching data, and code, not in any one provider's model. | ⚠️ Only via the **LLM gateway** the sandbox specification defines (🔲 planned — see below) | ⚠️ Conditional — see below |
| **A2** | API-dependent, non-substitutable | Requires runtime calls to an external data or service API that cannot be mirrored or substituted — typically because the served content is proprietary or unlicensed (e.g., a dictionary API whose underlying dictionary has no public license). | ❌ No — the dependency cannot exist in the sandbox without the rights holder's permission | ❌ Not until the rights holder grants sandbox-inclusion **and** transfer permissions. Allowed on the open (development-segment) leaderboard with a visible **"external dependency"** flag |
| **X** | Closed | Bundles content the submitter has no right to redistribute — unlicensed datasets, scraped proprietary content, license-incompatible components. | ❌ | ❌ Inadmissible in every lane. Bundling content without rights is a license violation regardless of where the method runs |

**Effective class.** A method's dependency class is the *most restrictive* class among all its declared dependencies, in the order S < O < A1 < A2 < X. One unlicensed dictionary makes an otherwise self-contained pipeline Class A2 (if accessed at runtime) or Class X (if bundled without rights).

### The A1/A2 Distinction: Substitutability

Most methods call LLMs. The Network does not pretend otherwise — but it distinguishes two very different kinds of API dependency:

- **A1 (substitutable):** The API provides commodity LLM inference. The model identifier is configuration: the method must run end-to-end against any compatible inference endpoint, including a community-hosted open-weight model. Output quality may differ across models — that is the developer's risk, and official scores are tied to the pinned model used in evaluation. A method that depends on **provider-side state** (a fine-tune hosted only at the provider, provider file stores, provider-specific assistants) is *not* substitutable: that state cannot be slotted out, so the dependency is A2 unless the underlying weights or data are included in the submission.
- **A2 (non-substitutable):** The API serves something unique — typically proprietary or unlicensed data. No alternative endpoint can provide it, and the content cannot be mirrored into the sandbox without the rights holder's permission. The method works on the open leaderboard (flagged), but cannot produce official sandbox scores or qualify for prizes until permissions exist.

**What an A1 prize transfer actually conveys.** The community does not receive the model — nobody can transfer Anthropic's, Google's, or OpenAI's weights. The transfer covers the complete recipe *around* the model: all prompts, coaching data, pipeline code, retry logic, configuration, and documented model requirements. Because the model is substitutable by construction, the community can point the transferred method at any provider they choose — or at an open-weight model on their own hardware — without the developer's involvement. The recipe is owned; the engine is rented and replaceable.

### Dependency Manifest (`method.json`)

Every method declares its dependencies in the `method.json` manifest. Each entry records what the artifact is, where it comes from, what license covers it, and how the method accesses it:

```json
{
  "name": "FST-Gated Coached Translation v8",
  "method_id": "fst-gated-v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "entry_point": "pipeline:PipelineMethod",
  "supported_pairs": ["eng>crk"],
  "dependency_class": "A2",
  "dependencies": [
    {
      "id": "giellalt-lang-crk-fst",
      "kind": "software",
      "license": "AGPL-3.0-or-later",
      "access": "mirrored",
      "source": "https://github.com/giellalt/lang-crk",
      "pin": "sha256:3f1a…",
      "redistributable": true,
      "transferable": true
    },
    {
      "id": "llm-inference",
      "kind": "model",
      "license": "proprietary",
      "access": "gateway",
      "source": "openrouter:google/gemini-2.5-flash",
      "substitutable": true,
      "redistributable": false,
      "transferable": false,
      "notes": "Any compatible chat-completions endpoint works; the model slug is configuration."
    },
    {
      "id": "crk-dictionary-api",
      "kind": "service",
      "license": "none",
      "access": "external-api",
      "source": "https://itwewina.altlab.app/",
      "redistributable": false,
      "transferable": false,
      "notes": "Dictionary content has no public license; runtime lookups only. Class A2 until the rights holders grant permission."
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | ✅ | Stable identifier for the dependency |
| `kind` | ✅ | `data`, `model`, `software`, or `service` |
| `license` | ✅ | SPDX identifier, `proprietary`, or `none`. `none` means no public license exists — treated as all-rights-reserved |
| `access` | ✅ | `bundled` (ships in the method directory), `mirrored` (fetched at install, pinned, vendored into the submission), `gateway` (runtime LLM inference via the evaluation gateway), `external-api` (any other runtime network call) |
| `source` | ✅ | Canonical URL or `provider:slug` identifier |
| `pin` | for `mirrored` | Version, commit, or content hash that pins the exact artifact |
| `substitutable` | for `gateway`/`external-api` | Whether any compatible endpoint can serve this dependency |
| `redistributable` | ✅ | Whether the license permits redistributing the artifact |
| `transferable` | ✅ | Whether the artifact (or rights to it) can convey to a community under prize transfer terms |
| `notes` | ❌ | Free-form context |

**Class derivation.** Each dependency contributes a class; the method's `dependency_class` is the most restrictive:

| Dependency profile | Contributes |
|--------------------|-------------|
| `bundled` + license permits redistribution and transfer | S |
| `mirrored` + open license permitting redistribution (copyleft included) | O |
| `gateway` + `substitutable: true` (LLM inference) | A1 |
| `external-api`, or `gateway` with `substitutable: false` | A2 |
| `bundled` + `license: none` or redistribution-incompatible license | X |

The declared `dependency_class` must match the class the harness derives from the manifest. A mismatch is a validation error.

A method with **no** external dependencies declares `"dependency_class": "S"` and `"dependencies": []`. The empty array is an affirmative statement, audited like any other.

### How Validity Is Verified

Three layers, from cheapest to most authoritative:

1. **Manifest audit.** The harness derives the effective class from the manifest and rejects mismatches. Reviewers check each declared dependency against its stated license and source — a dependency declared `redistributable: true` whose upstream license says otherwise fails review.
2. **Static analysis.** Submitted code is scanned for network calls, dynamic downloads, and filesystem access that the manifest does not account for. An *undeclared* dependency found in review is grounds for rejection regardless of what class it would have been — the manifest must be complete, not just accurate.
3. **Sandbox network policy.** The sandbox specification requires **default-deny egress**: method containers get no network access unless a path is explicitly allowlisted. The only egress path the specification defines is the **LLM gateway** — an inference proxy operated by the evaluation infrastructure, restricted to an explicit allowlist of pinned models, with every request and response logged for post-run audit. Anything not on the allowlist fails at the network layer, not at the policy layer. See [Benchmark Specification §8.6](/docs/network/specifications/benchmark) for the network policy and gateway design.

> **Two different sandboxes — one planned, one live.** Read this carefully, because the word "sandbox" covers two distinct things:
>
> - 🔲 **Planned: the platform sandbox and its LLM gateway.** The evaluation-infrastructure-operated environment described in this section — the one whose LLM gateway would let Class A1 methods produce official gold-standard scores — is specified but not yet built. Until it is, Class A1 methods are prize-eligible *in principle* but cannot yet produce official gold-standard scores.
> - ✅ **Live: the organizer-node method-execution lane.** A contest organizer's own scoring node already executes proposed method bundles inside a network-isolated container (`mt-eval node run-method`): built and run with `--network=none`, read-only root, dependencies vendored — which restricts it to methods that need no runtime network (Class S/O by construction). It can run on a true-airgap machine with signed scores-only bundles crossing by removable media. See [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) for the end-to-end path.
>
> This section describes what the platform specification requires, not what currently runs on the platform.

### Leaderboard Display

- The leaderboard shows each method's dependency class alongside its method class badge.
- Class A2 methods on the open leaderboard carry a visible **"external dependency"** flag: their scores depend on a third-party service that may change or disappear, and they are not currently prize-eligible.
- Class X methods are not listed.

## Eval Harness: TranslationMethod Protocol {#eval-harness-translationmethod-protocol}

The eval harness uses Python's structural typing (`Protocol`) for plugins. Any class with the right members works — no inheritance required. The protocol has **three** required members, not just `translate`:

1. **`name`** (`str`) — human-readable method name, used in run IDs and logs.
2. **`method_card()`** (`-> dict | None`) — method metadata for provenance tracking, embedded in the run log and published run card. Return `None` if the method has no card.
3. **`async translate(entries, config)`** (`-> list[dict]`) — the translation itself: a batch of entries in, one result dict per entry out.

When the harness loads a plugin via `--method path/to/dir`, it validates that `translate` is callable and then reads `method.name` and calls `method.method_card()` unconditionally — a plugin missing either will crash at load time, not fail gracefully.

```python
class MyMethod:
    name = "My Pipeline v1"  # required — run IDs and logs

    def method_card(self) -> dict | None:
        # required — provenance metadata (or None for no card)
        return {
            "method_id": "my-pipeline-v1",
            "name": self.name,
            "class": "pipeline",
        }

    async def translate(self, entries: list[dict], config: RunConfig) -> list[dict]:
        results = []
        for entry in entries:
            translation = await self.do_translation(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translation,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "error": None,
                "tool_calls": [],
                "tool_call_count": 0,
                "metadata": {},
            })
        return results
```

The plugin directory needs a `method.json` manifest with at least `name` and `entry_point` (`"module_name:ClassName"` — the module is loaded from the plugin directory and the class instantiated). If a returned method card declares a `class` or `paradigm`, it must use the canonical vocabulary above — an off-taxonomy card fails validation at load time rather than silently dropping off the leaderboard's filters.

For a full worked example — building, running, and submitting a plugin end-to-end — see [Submit a Method](/docs/network/getting-started/submit-a-method) and the [FST-Gated Pipeline cookbook](/docs/network/tutorials/fst-gated-pipeline).

## champollion: methodPlugin Config

In champollion, methods are registered per language pair in `champollion.config.json`:

```json
{
  "version": 3,
  "pairs": {
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

See the [Plugin Spec](https://champollion.dev/docs/reference/plugin-spec) for the champollion-side interface.

## Leaderboard Integration

When a method card is attached to a run (via `--method-card`), it's embedded in the run card and displayed on the leaderboard:

```bash
# Run with method card attached
mt-eval run \
  --method path/to/my-method \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method-card method_card.json

# Publish to the leaderboard
mt-eval publish eval/logs/harness/your-run-card.json
```

If no `--method-card` was provided, `mt-eval publish` launches an interactive wizard that walks you through describing your method.

The leaderboard shows:
- **Class badge** — visual indicator (e.g., "pipeline", "coached-llm")
- **Paradigm** — the algorithmic paradigm (e.g., "rule-based", "neural-nmt", "llm", "hybrid"), a filterable column (see [Paradigms](#paradigms))
- **Dependency class** — S/O/A1/A2 (see [Method Validity and Dependency Classes](#method-validity-and-dependency-classes)); A2 methods carry an "external dependency" flag
- **Method name** — from the method card
- **Tools used** — listed from the method card
- **Open source indicator**

When no method card is attached, the leaderboard shows harness-native configuration (model, prompt version, temperature, tools enabled).

:::danger[DO NOT TRAIN on evaluation data]
Methods whose development process included exposure to the evaluation dataset — as training data, few-shot examples, dictionary entries, or prompt tuning material — will be **disqualified** from the leaderboard. See [MT Evaluation](/docs/network/leaderboard/rules) for what distinguishes a good method from a bad one.
:::

---

## See Also

- [MT Evaluation](/docs/network/leaderboard/rules) — overview, leaderboard value, and good/bad method guidance
- [Eval Harness](/docs/network/specifications/harness) — how to run evaluations
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — available datasets (EDTeKLA, FLORES+)
- [Run Card Specification](/docs/network/specifications/run-card) — the run card JSON schema
- [Plugin Spec](https://champollion.dev/docs/reference/plugin-spec) — champollion-side plugin interface
- [Method Leaderboard](https://champollion.dev/leaderboard) — live benchmark scores
- [Benchmark Specification](/docs/network/specifications/benchmark) — evaluation protocol, corpus format, run card schema
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT for metrics, composite weights, and quality tiers
