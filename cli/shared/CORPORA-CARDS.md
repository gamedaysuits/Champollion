# Corpora Cards

> **Corpora cards are the single source of truth (SSOT) for all dataset metadata in Champollion.** They describe evaluation sets and reference corpora in a structured, fact-checked format that all components (arena, harness, website) load from.

## Architecture

```
cli/shared/corpora-cards/       ← SSOT: metadata about datasets
arena/datasets/curated/         ← DATA: actual sentence pairs
arena/datasets/registry.json    ← GENERATED: index for harness resolver
```

| Layer | Contains | Role | Edited by |
|-------|----------|------|-----------|
| **Corpora cards** | License, provenance, contamination, stewardship | Truth about what a dataset IS | Humans (fact-checked) |
| **Curated data** | `{entries: [{id, source, reference}]}` | The actual sentences | Scripts + community |
| **Registry** | Paths, IDs, sizes | What the harness loads | `build_registry.py` only |

> [!CAUTION]
> **Never edit `registry.json` directly.** Edit the corpora card, then run `python arena/scripts/build_registry.py` to regenerate the registry.

---

## Two Types of Cards

### Reference Corpus (`ref-*.json`)

Catalogues an external dataset that exists in the world. These are for development and practice — **NOT used for official Champollion evaluation**.

Examples: FLORES+, NTREX-128, Tatoeba Challenge, AmericasNLP shared task data.

**Use reference cards when:** You want to document a dataset that users can download for development, note its contamination risk, or track its license terms.

### Champollion Eval Set (`eval-*.json`)

A pair-specific, community-curated dataset used for official Champollion evaluation. These are the real benchmarks.

**Key properties:**
- **Pair-specific**: One source language → one target language
- **Directional**: `eng→crk` is a different eval set from `crk→eng`
- **Community-created**: Quality-controlled by language community members
- **May have a secret test split**: Created by and controlled by the community

**Use eval cards when:** A dataset has been curated for evaluating MT quality on a specific language pair.

---

## Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Reference | `ref-{name}.json` | `ref-flores-plus.json` |
| Eval set | `eval-{src}-{tgt}-{source}-{segment}-v{N}.json` | `eval-eng-crk-edtekla-dev-v1.json` |

The `eval-` prefix makes it instantly clear this is a benchmark, not just a dataset catalogue entry.

---

## Official Champollion Evaluation

Official eval sets have three components:

| Split | Location | Access | Purpose |
|-------|----------|--------|---------|
| **Dev** | `curated/` (distributed) | Everyone | Local testing, prompt tuning |
| **Test** | `curated/` (distributed) | Everyone | Self-scoring, debugging |
| **Secret** | Server-side only | Server process only | Official leaderboard scoring |

### Secret Test Sets

Secret test sets are **created by the language community, not held-out splits from public data**. They are:

- Never distributed with the package
- Never visible to method authors
- Cryptographically hashed (SHA-256 published in the card for integrity verification)
- Only unlocked by steward authorization

### Multi-Signature Stewardship

Each official eval set has a stewardship council:

- **5 stewards** appointed by the language community
- **3 of 5 approvals** needed to authorize a secret test run
- Stewards receive push notifications via app
- **Consent is per-submission** — no blanket authorization
- Each authorization is logged and auditable

### Method Submission Flow

```
Method author submits to arena
  │
  ├─→ PUBLIC EVAL (dev set)
  │     Results displayed immediately
  │
  └─→ SECRET EVAL REQUEST
        Status: "Pending Steward Authorization"
        │
        ├─→ 5 stewards notified via app
        │   3/5 push "Authorize"
        │   Keys unlock secret test set
        │
        ├─→ Method runs in sandbox against secret test
        │   Scores computed server-side
        │   Results posted to arena
        │
        └─→ IF scores ≥ acceptance threshold:
              Status: "Under Community Review for Prize"
              IP transfer agreement activated
```

### IP Transfer on Success

By submitting a method for secret evaluation, the author agrees to transfer all rights to the technology and intellectual property to the evaluation stewards if the method passes the community's acceptance threshold.

> [!WARNING]
> **Infrastructure status**: The steward app, multi-sig key management, server-side sandbox, and eval API are **not yet built**. The corpora card schema accommodates them via `secretTest`, `stewardship`, and `submission` fields, but these contain placeholder values until the infrastructure exists.

---

## Schema Reference

### Core Fields (all cards)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique ID. Must match filename. Pattern: `ref-*` or `eval-*`. |
| `type` | enum | ✅ | `"reference"` or `"eval"` |
| `name` | string | ✅ | Human-readable name |
| `version` | string | ✅ | Corpus version (semver recommended) |
| `description` | string | ✅ | What it is and why it matters |
| `source` | object | ✅ | Publisher, URL, paper, citation |
| `license` | object | ✅ | SPDX, commercial use, redistribution, AI training terms |
| `contamination` | object | ✅ | Risk level + evidence-based reasoning |
| `_provenance` | object | ✅ | When added + what sources were consulted |

### Eval-Only Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pair` | object | ✅ | Source/target ISO 639-3 codes + direction |
| `dev` | object | ✅ | Dev split metadata: size, domain, data file path |
| `doNotTrain` | boolean | ✅ | Must be explicitly set for eval data |
| `quality` | object | — | Human-translated? Translator qualifications? Review process? |
| `secretTest` | object | — | Secret test set hash, status, server endpoint |
| `stewardship` | object | — | Steward list, threshold, authorization model |
| `submission` | object | — | IP transfer terms, acceptance threshold |

### Reference-Only Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `languages` | string[] | ✅ | ISO 639-3 codes of all languages covered |
| `download` | object | ✅ | Method, URL, instructions |
| `segments` | object[] | — | Available data splits (dev, devtest, test) |

---

## Building the Registry

After editing corpora cards, regenerate `registry.json`:

```bash
# Preview what would be generated
python arena/scripts/build_registry.py --dry-run

# Show diff against current registry
python arena/scripts/build_registry.py --diff

# Build
python arena/scripts/build_registry.py
```

---

## Registering a Corpus: License + Exposure

The fastest, safest way to author an eval card is the guided command — it puts
**you** in control of the license and how far the corpus travels, and it
**never reads, uploads, or hosts your corpus text** (in any tier):

```bash
champollion register-corpus            # interactive wizard
champollion register-corpus --list     # show licenses + exposure tiers
champollion register-corpus --help      # all flags (scriptable for agents)
```

### License (plain language)

Pick what others may do with your set. The choice fills in `license.spdx` plus
the `commercial` / `redistribution` booleans on the card:

| Option | Means |
|--------|-------|
| **CC-BY-4.0** | Use and share freely, even commercially, with credit. |
| **CC-BY-SA-4.0** | Like CC-BY, but derivatives must share alike. |
| **CC0 / public domain** | No rights reserved; anyone may do anything. |
| **CC-BY-NC-4.0** | Non-commercial use only — **blocked from public/ranked lanes**. |
| **Proprietary / all rights reserved** | You keep full control; not publicly redistributable. |
| **Other / custom** | Unconfirmed — treated as not-redistributable until verified. |

You may also pass any SPDX id to `--license`; it is classified through
[`cli/lib/license-gate.mjs`](lib/license-gate.mjs).

### Exposure tiers (default: the most private)

Chosen explicitly with `--tier`. Champollion never hosts content in **any** of them:

| Tier | What happens | Card lands in |
|------|--------------|---------------|
| **local-only** *(default)* | Never registered, never uploaded. Card + text stay on your machine. | your working dir (`--out`), **not** the tracked SSOT |
| **private** | Register **metadata only** — a WMT-style sovereign/held-out set. Text never uploaded or hosted; you keep custody. The card is `quarantine: true` (catalogued, not publicly runnable). | `corpora-cards/` |
| **public** | Publish a metadata card **+ a fetch-from-source pointer** (`source.repo_url` + `builder`). Text is fetched from source on demand — never hosted here. **Gated**: NC / no-redistribute / unconfirmed licenses are rejected; use private/local-only instead. | `corpora-cards/` |

The tier is recorded on the card as `exposureTier`. Consumer-report metadata
(license, contamination risk, size/length, domain) is collected at registration
so every new set is properly marked.

> [!NOTE]
> **We never store your text.** `register-corpus` writes a *metadata card*, not
> your sentences. For `public`, the data is fetched from `source.repo_url` by the
> declared builder at run time; for `private`/`local-only`, it never leaves your
> machine. The CI quarantine gate (`scripts/quarantine_gate.sh`) enforces this.

---

## Adding a New Dataset

### Adding a Reference Corpus

1. Create `cli/shared/corpora-cards/ref-{name}.json`
2. Fill in ALL required fields from the dataset's official documentation
3. Set `contamination.risk` with evidence-based reasoning
4. Set `_provenance.populatedFrom` to the exact documents you consulted
5. Verify: `source.url` must resolve, `license.spdx` must match actual license

### Adding an Eval Set

**Recommended:** run `champollion register-corpus` (see
[Registering a Corpus](#registering-a-corpus-license--exposure) above) — it
writes a schema-valid card with the license + exposure tier you choose, and
never touches your text. Then rebuild the registry. To author by hand instead:

1. Create `cli/shared/corpora-cards/eval-{src}-{tgt}-{name}-{segment}-v{N}.json`
2. Add the actual data file to `arena/datasets/curated/` **only** for permissive,
   redistribution-cleared corpora — never for private/NC/no-redistribute content
   (those stay fetch-from-source or local; see exposure tiers above)
3. Verify `dev.size` matches `jq '.entries | length'` on the data file
4. Run `python arena/scripts/build_registry.py` to update the registry
5. Run `npm test` in `cli/` to verify nothing is broken

### Population Rules

- **Every field must come from a verifiable source.** No guesses, no "seems reasonable."
- If you can't verify a field, set it to `null`.
- `_provenance.populatedFrom` must cite the specific document/URL consulted.
- `contamination.reasoning` must cite evidence for the risk rating.
- `quality.translatorQualifications` stays `null` unless the paper describes who translated.

---

## Cross-References

### Language Cards → Corpora Cards

Language cards reference eval sets via the `evalDatasets` field:

```json
// In cli/shared/language-cards/crk.json:
"evalDatasets": ["eval-eng-crk-edtekla-dev-v1"]
```

The string is the corpora card ID. It resolves to `cli/shared/corpora-cards/eval-eng-crk-edtekla-dev-v1.json`.

Reference corpora (FLORES+, etc.) are **NOT** listed in `evalDatasets`. They belong in `corpusAvailability` — they are development resources, not evaluation benchmarks.

### Harness → Corpora Cards

The harness resolver (`config.py:resolve_dataset()`) loads datasets via registry.json, which is generated from the cards. The flow:

```
User runs: mt-eval run --corpus eval-eng-crk-edtekla-dev-v1
  → resolve_dataset() checks local path (not found)
  → loads registry.json
  → finds entry with matching ID
  → loads curated/eng-crk-dev-v1.json
  → runs evaluation
```
