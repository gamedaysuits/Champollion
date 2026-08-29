---
sidebar_position: 7
title: Corpus Design Framework
---

# Evaluation Corpus Design Framework

When you evaluate a frontier model on FLORES+ and it scores 85 chrF++, you
cannot distinguish "the model is good at translating" from "the model
memorized these specific sentence pairs." That single ambiguity is why this
framework exists: an evaluation corpus is only worth building if its scores
mean what they claim, and that takes deliberate design — fresh pairs,
tracked provenance, stratified domains, tiered difficulty. This page is the
source of truth for how Champollion evaluation datasets are designed,
constructed, and maintained.

> **Version:** 1.0 · **Status:** Draft · Companion: the
> [Corpus Partnership](/docs/network/specifications/corpus-partnership)
> workflow puts this methodology into practice with a research department.

---

## 1. Design Principles

### 1.1 — Why Not Public Benchmarks?

Public parallel corpora (FLORES+, Tatoeba, WMT test sets, OPUS) are available for development and debugging but are **excluded from official leaderboard evaluation**. The reason is straightforward:

**Contamination.** Frontier LLMs are trained on enormous web scrapes. Any parallel text that has existed publicly — especially in curated, widely-cited benchmark datasets — is likely in their training data. This is not a theoretical concern — [research has demonstrated](https://arxiv.org/abs/2311.04850) measurable contamination effects on MT benchmarks. (Public benchmarks do still run here — but only in a *relative-comparison* lane that can rank methods against each other, never as absolute quality.)

For Champollion, this matters acutely because:
- The leaderboard compares LLM methods, classic MT services, and purpose-built systems side by side
- Our value proposition is *honest, rigorous evaluation*
- Our target users (language communities) make deployment decisions based on these scores

### 1.2 — Core Requirements

Every Champollion evaluation corpus must satisfy:

| Requirement | Rationale |
|-------------|-----------|
| **Human-authored** | No synthetic data. All source text and reference translations must be written by humans. LLMs may assist with alignment and formatting but never generate content. |
| **Not publicly available in parallel form** | The source text may be public; the reference translations may be public; but the specific *pairing* must not exist as a downloadable parallel corpus. |
| **Provenance-tracked** | Every entry must have documented origin: source document, translator, license, date. |
| **Linguistically informed** | Coverage must be guided by typological features, not random sampling. |
| **Domain-stratified** | Entries must span defined text domains with controlled representation. |
| **Difficulty-tiered** | Entries must be assigned difficulty tiers (1–5) based on structural complexity. |
| **Version-controlled** | Corpus versions are content-hashed. Scores are only comparable within the same version. |
| **Community-reviewable** | Reference translations must be reviewable by language community members. |

### 1.3 — Corpus-Type, Length, and Style Neutrality

Champollion is an open translation-evaluation hub that is **neutral on what a translation unit is**. A corpus entry is arbitrary-length text — a single short sentence, a long multi-clause sentence, a paragraph, or a whole document — and the platform evaluates all of them the same way. **There is no restriction to short or easy text.** The harness imposes no length cap (it deliberately sets generous output token headroom to avoid truncating long translations); difficulty tiers (§3) and domains (§2.1) are *configurable axes*, not gates that exclude hard or long material.

The hub is neutral and configurable across:

| Axis | Range |
|------|-------|
| **Granularity** | sentence · long-form sentence · paragraph · document (`sizeUnit: entries \| sentences \| segments \| documents`) |
| **Length & complexity** | short → long; simple → highly complex (difficulty tiers 1–5) |
| **Style & register** | formal, informal, technical, literary, conversational, administrative (domain taxonomy, §2.1) |
| **Method** | any `TranslationMethod` — LLM, neural NMT, rule-based, hybrid, human |
| **Language & pair** | any directed pair; no high-resource bias baked in |

A corpus declares its own type, granularity, register, and difficulty in its card, and the harness honours whatever the card declares. The default Tatoeba-sourced **development** corpora are short sentences because Tatoeba is — that is a property of those source corpora, **not** a platform limit. Document-level and long-form evaluation sets are first-class; register them the same way (and, e.g., for very long entries, configure a smaller request batch).

---

## 2. Source Text Selection

### 2.1 — Domain Taxonomy

Champollion evaluates translation for **practical deployment contexts**, not academic exercises. Every corpus entry is tagged with a domain from the **canonical 16-code domain taxonomy**, which is validated at construction time.

The taxonomy is defined once — in [Benchmark Specification §2.7](/docs/network/specifications/benchmark#27-domain), the single source of truth — and is not restated here to avoid drift. The codes are: `conv`, `ecommerce`, `edu`, `financial`, `gov`, `legal`, `literary`, `marketing`, `medical`, `news`, `religious`, `scientific`, `subtitles`, `support`, `tech`, and `ui`. See §2.7 for each code's description and typical consumers. Do not introduce domain codes outside that set.

### 2.2 — Domain Distribution

A standard evaluation corpus should aim for a spread across the domains most relevant to the target community. The exact codes and percentages vary by language pair; the table below is one *illustrative* target distribution, using the canonical codes from §2.1:

| Domain | Code | Target % | Rationale |
|--------|------|----------|-----------|
| Software UI | `ui` | 25% | Primary deployment context for champollion CLI users |
| Government / administrative | `gov` | 15% | High-stakes translation with legal implications |
| Educational | `edu` | 15% | Core use case for language revitalization |
| Literary / narrative | `literary` | 10% | Tests cultural nuance and literary register |
| Conversational | `conv` | 10% | Tests informal register and natural speech patterns |
| Technical | `tech` | 10% | Tests precision and terminology consistency |
| Medical / health | `medical` | 10% | High-stakes, tests domain-specific vocabulary |
| News / journalistic | `news` | 5% | Tests contemporary vocabulary and neutral register |

### 2.3 — Source Selection Criteria

When selecting source texts for a new corpus:

1. **License compatibility.** Source text must be under a license that permits use in an evaluation corpus. Prefer CC BY, CC BY-SA, or public domain. Document the license.

2. **Recency.** Prefer texts published within the last 10 years. Language evolves — especially vocabulary around technology, governance, and medicine.

3. **Register diversity.** Within each domain, seek texts at different formality levels. A government press release (formal) and a government social media post (informal) are both `admin` domain but different registers.

4. **Cultural relevance.** For Indigenous and minority languages, prioritize texts that matter to the community — land management documents, educational materials in the language, cultural preservation texts — over texts that happen to exist in parallel.

5. **No machine-translated sources.** If a "parallel" document was created by running the original through Google Translate and then post-editing, it is NOT acceptable as a reference translation. The reference must be an independent human translation.

---

## 3. Difficulty Tier System

### 3.1 — Tier Definitions

Every entry is assigned a difficulty tier (1–5) based on the structural complexity of the *source text*, not the translation difficulty (which varies by method).

| Tier | Label | Structural Characteristics |
|------|-------|---------------------------|
| 1 | **Elementary** | Simple sentences. Single clause. Present tense. Common vocabulary. No idioms. No embedded structures. |
| 2 | **Intermediate** | Compound sentences. Two clauses joined by conjunction. Past/future tense. Some domain vocabulary. |
| 3 | **Advanced** | Complex sentences. Subordinate clauses, relative clauses. Mixed tenses. Domain-specific terminology. Passive voice. |
| 4 | **Expert** | Multiple embedded clauses. Legal/technical register. Conditional structures. Abstract concepts. Cultural references. |
| 5 | **Extreme** | Dense prose with multiple simultaneous challenges: nested subordination, ambiguous pronoun reference, cultural idioms, mixed register, rare vocabulary. |

### 3.2 — Linguistically Informed Difficulty Factors

Beyond structural complexity, difficulty is modulated by **typological distance** between the source and target language. These factors are drawn from WALS typological features and the language card's classification data:

| Factor | Low Difficulty | High Difficulty |
|--------|---------------|-----------------|
| **Word order** | Same basic order (e.g., SVO→SVO) | Different basic order (e.g., SVO→SOV) |
| **Morphological type** | Similar type (e.g., analytic→analytic) | Different type (e.g., analytic→polysynthetic) |
| **Grammatical gender** | Same system or no gender | Source has no gender, target has complex gender |
| **Honorific/register** | No register marking | Target has complex register system (e.g., Japanese, Korean) |
| **Script** | Same script | Different script (transliteration required) |
| **Animacy** | No animacy distinction | Target has animacy-based agreement (e.g., Cree) |
| **Evidentiality** | No evidentiality | Target marks information source grammatically |

### 3.3 — Tier Distribution

A standard corpus should have approximately:

| Tier | Target % | Rationale |
|------|----------|-----------|
| 1 | 15% | Establishes baseline — even bad methods should handle these |
| 2 | 25% | Bread-and-butter practical translation |
| 3 | 30% | Where method quality differences become visible |
| 4 | 20% | Separates good methods from great ones |
| 5 | 10% | Ceiling test — very few methods will handle these well |

---

## 4. Reference Translation Quality

### 4.1 — Translator Requirements

Reference translations must be produced by humans who are:

1. **Fluent speakers** of the target language (L1 or equivalent)
2. **Literate** in both source and target language
3. **Domain-aware** for the domain of the text (a medical translator for health texts, etc.)
4. **Independent** — the translator must not have access to any MT output for the same text during translation

### 4.2 — Translation Brief

Every translator receives a brief that includes:

- The **register** to use (formal, conversational, etc.)
- The **target audience** (general public, specialists, children, etc.)
- Any **terminology conventions** specific to the language community
- Explicit instruction: "Translate the meaning, not the words. A natural-sounding translation is more valuable than a literal one."

### 4.3 — Quality Assurance

1. **Dual translation.** Ideally, each entry has two independent reference translations by different translators. Where this isn't feasible, prioritize dual translation for Tiers 4–5.

2. **Community review.** Reference translations should be reviewed by at least one additional speaker who did not produce the translation.

3. **Acceptable variants.** For each reference, document known acceptable variants (word order, orthographic conventions, dialectal forms). These feed the `equivalent_match_rate` metric.

### 4.4 — What Makes a Bad Reference

| Problem | Why It Invalidates Evaluation |
|---------|------------------------------|
| Machine-translated then post-edited | Post-editing preserves MT structure; penalizes methods that produce more natural translations |
| Translated by a learner, not a fluent speaker | Reference may contain errors that penalize correct MT output |
| Overly literal | Natural translations score poorly against literal references |
| Single valid interpretation for ambiguous source | Penalizes valid alternative interpretations |

---

## 5. Contamination Prevention

### 5.1 — The Contamination Threat Model

| Threat | Description | Mitigation |
|--------|-------------|------------|
| **Training data overlap** | LLMs trained on the parallel corpus | Don't publish the parallel corpus publicly |
| **Few-shot leakage** | Method author uses eval entries as few-shot examples | Fingerprint-check: entries in the prompt are detected and flagged |
| **Indirect contamination** | Source text exists in LLM training data (monolingual) | Acceptable — monolingual source text is expected. The *pairing* must be novel. |
| **Crowd contamination** | Community reviewers share entries publicly | License terms prohibit redistribution of the parallel corpus |

### 5.2 — Corpus Secrecy Tiers

| Tier | Visibility | Use |
|------|-----------|-----|
| **Public development set** | Fully public | Method development, debugging, regression testing. Scores NOT published to leaderboard. |
| **Held-out evaluation set** | Source text visible, references secret | Official leaderboard evaluation. Methods receive source text and return translations; scoring happens server-side. References are never exposed to the method. |
| **Gold-standard set** | Fully secret, community-controlled | Community-validated evaluation. Managed by governance organization. Used for "Community Validated" verification tier. |

### 5.3 — Rotation Policy

Evaluation corpora should be **rotated** periodically:

1. After a corpus has been in use for 12 months, begin constructing a replacement
2. Retire the old corpus to "development set" status (public)
3. Promote the new corpus to "held-out evaluation set"
4. This prevents gradual contamination through iterative optimization against a fixed target

---

## 6. Corpus Construction Workflow

### 6.1 — Step-by-Step Process

```
Step 1: Language Pair Selection
    └─ Identify target language, read language card
    └─ Review typological features (WALS), contact influences, scripts
    └─ Identify which difficulty factors apply

Step 2: Source Text Curation
    └─ Identify candidate source documents per domain
    └─ Verify licenses
    └─ Extract candidate sentences/segments
    └─ Classify by domain and preliminary difficulty tier

Step 3: Segment Selection
    └─ Sample segments to match domain distribution (§2.2)
    └─ Sample segments to match difficulty distribution (§3.3)
    └─ Ensure linguistic phenomenon coverage (§6.2)
    └─ Target minimum corpus size (§6.3)

Step 4: Reference Translation
    └─ Assign segments to qualified translators
    └─ Provide translation brief
    └─ Collect translations
    └─ Dual-translate Tier 4–5 entries

Step 5: Quality Assurance
    └─ Community review of references
    └─ Document acceptable variants
    └─ Flag and resolve disagreements

Step 6: Metadata & Packaging
    └─ Assign final difficulty tiers
    └─ Add provenance metadata per entry
    └─ Content-hash the corpus for versioning
    └─ Package as corpus JSON per harness spec

Step 7: Registration
    └─ Register in Supabase datasets table
    └─ Add to ATTRIBUTION.md if new sources used
    └─ Document in arena website
```

### 6.2 — Linguistic Phenomenon Coverage

Every corpus should include entries that test specific linguistic phenomena relevant to the language pair. These are drawn from the language card's `linguisticChallenges` and `contactInfluences` fields:

**Universal phenomena (all language pairs):**
- Pronoun resolution (ambiguous antecedents)
- Negation (single, double, scope)
- Quantifiers (all, some, none, most)
- Temporal expressions (relative dates, durations)
- Named entities (people, places, organizations)
- Numbers and measurements
- Lists and enumeration

**Pair-specific phenomena (from language card):**
- For polysynthetic targets: complex verb morphology, incorporation
- For gendered targets: gender agreement, neutral/inclusive reference
- For SOV targets: clause-final verbs, postpositions
- For tone languages: tone-dependent meaning distinctions
- For honorific languages: register markers, social context
- For contact languages: code-switching boundaries, loanword integration

### 6.3 — Minimum Corpus Size

Statistical reliability requires minimum entry counts. These are based on paired bootstrap confidence interval requirements (from `significance.py`):

| Purpose | Minimum Entries | Recommended |
|---------|-----------------|-------------|
| Development set | 50 | 100–200 |
| Held-out evaluation set | 100 | 200–500 |
| Gold-standard set | 200 | 500+ |
| Per-domain minimum | 10 | 25+ |
| Per-tier minimum | 10 | 20+ |

**Why 100 minimum for evaluation?** With fewer than ~100 entries, paired bootstrap significance tests (1,000 resamples) cannot reliably detect differences smaller than ~5 chrF++ points. With 200+ entries, we can detect ~2-point differences at p<0.05.

---

## 7. Corpus JSON Format

Every corpus entry follows the harness specification:

```json
{
  "id": "edtekla-dev-v1-042",
  "source": "The school board will meet on Tuesday to discuss the new curriculum.",
  "reference": "ᑭᓯᑭᓄᐦᐊᒫᑐᐏᓐ ᑲ ᐃᔑ ᐱᒥᐸᔨᐦᑕᐦᒃ ᑭᔅᑭᓄᐦᐊᒫᑐᐏᓇ ᐁ ᐃᔑ ᒫᒥᑐᓀᔨᐦᑕᐦᒃ ᐅᔥᑭ ᑭᔅᑭᓄᐦᐊᒫᑫᐏᓂᔭ ᓂᔓ ᑭᔑᑲᐤ",
  "acceptable_variants": [
    "ᑭᔅᑭᓄᐦᐊᒫᑐᐏᓐ ᓂᔓ ᑭᔑᑲᐤ ᑲ ᐃᔑ ᒫᒥᑐᓀᔨᐦᑕᐦᒃ ᐅᔥᑭ ᑭᔅᑭᓄᐦᐊᒫᑫᐏᓂᔭ"
  ],
  "domain": "edu",
  "difficulty": 3,
  "phenomena": ["temporal_expression", "named_entity", "future_tense"],
  "provenance": {
    "source_doc": "EdTeKLA Module 4, Unit 7",
    "source_license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0",
    "translator": "anonymous-speaker-001",
    "translator_qualification": "L1 Plains Cree, certified translator",
    "translation_date": "2025-11-15",
    "reviewer": "anonymous-speaker-002",
    "review_date": "2025-12-01"
  }
}
```

---

## 8. Anti-Gaming Measures

### 8.1 — Corpus Integrity

| Measure | Implementation |
|---------|----------------|
| **Content hashing** | Corpus version = SHA-256 of sorted entry IDs + references. Any modification produces a new version. |
| **Entry fingerprinting** | Each entry has a content-derived ID. If someone submits results against a modified corpus, the fingerprint won't match. |
| **Held-out enforcement** | For official evaluation, methods receive ONLY source text. References are never exposed. Scoring happens server-side. |
| **Rotation schedule** | Corpora rotate annually to prevent long-term optimization against a fixed target. |

### 8.2 — Submission Integrity

| Measure | Implementation |
|---------|----------------|
| **Deterministic fingerprint** | Run config (model, temperature, prompt, corpus version) is hashed. Identical configs produce identical fingerprints. |
| **Cherry-pick detection** | Submitters must disclose all runs, not just the best one. Multiple submissions with the same fingerprint are flagged. |
| **Contamination check** | If eval entries appear verbatim in the method's prompt or coaching data, the submission is disqualified. |

---

## 9. Existing Corpora

### 9.1 — EDTeKLA Development Set v1

| Property | Value |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Pair** | EN → CRK (Plains Cree, SRO) |
| **Entries** | 436-entry dev split (`textbook_dev.json`). Full breakdown is stated once on the [Evaluation Datasets page](/docs/network/leaderboard/datasets#edtekla-development-set-v1). |
| **Domains** | Educational (100%) |
| **Tiers** | 1–5 (distribution TBD per entry audit) |
| **License** | EdTeKLA's modified CC BY-NC-SA (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, sovereignty-scoped) — **carved out of the leaderboard, prize, and commercial/API lanes** (non-commercial) |
| **Status** | Development set (public) |

**Limitations:** Single domain (educational only). No domain stratification. Tier assignments may need audit. Small corpus size limits statistical power for significance testing.

### 9.2 — Planned Corpora

| Corpus | Pair | Status | Owner |
|--------|------|--------|-------|
| EN → TL (Filipino) custom corpus | EN → TL | Planned | Project owner |
| EN → CRK held-out set | EN → CRK | Future (needs community partner) | Community governance org |

---

## 10. Language Card Integration

The corpus framework integrates with the language card system:

1. **Domain selection** is informed by the card's `linguisticChallenges` — if a language has unique challenges (polysynthesis, tone, animacy), the corpus must include entries that test them.

2. **Difficulty calibration** uses the card's `classification` — typological distance between source and target families affects what constitutes "difficult."

3. **Register coverage** uses the card's `registers` — if a language has defined registers (formal-filipino, taglish-professional, taglish-casual), the corpus should include entries at each register level.

4. **Contact influence testing** uses the card's `contactInfluences` — for languages with heavy borrowing layers (Filipino: Spanish + English + Arabic), include entries that test whether methods handle loanwords correctly vs. over-translating them.

5. **Script handling** uses the card's `scripts[]` — for multi-script languages (Serbian: Cyrillic + Latin), include entries that test correct script selection.

---

## References

- **Champollion Scoring Specification** — defines all metrics, composite weights, quality tiers
- **Champollion Benchmark Specification** — evaluation protocol, corpus format, data sovereignty
- **WALS** (World Atlas of Language Structures) — typological features database
- **Glottolog** — language classification source of truth
- **ISO 639-3** — language identification standard
- **EdTeKLA** — source of the first evaluation corpus

---

*This document is a living specification. Update it as new corpora are built and lessons are learned.*
