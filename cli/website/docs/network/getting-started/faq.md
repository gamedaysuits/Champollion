---
sidebar_position: 2
title: FAQ
related:
  - label: "How It Works"
    to: /docs/network/how-it-works
    kind: doc
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Glossary"
    to: https://champollion.dev/glossary
    kind: glossary
    note: "Plain-language definitions for every technical term"
---

# Frequently Asked Questions

> **Executive Summary.** Answers to common questions about the Champollion Network — how scoring works, what gets disqualified, how to handle languages without FSTs, model and parameter recommendations, and the submission process.

---

## Scoring & Metrics

### What metrics does the harness compute?

The harness computes five metrics. Three are language-agnostic and work for any language pair; two currently rely on CRK-specific plugins and will be generalized as we expand to more languages. The runnable reference corpora today are open-licensed public sets — Global Voices, Tatoeba, TICO-19, IN22, SMOL, and more (see [Datasets](/docs/network/leaderboard/datasets)) — and the leaderboard is open for submissions across every registered pair. Plains Cree is simply where the two language-specific (FST-backed) metrics were first implemented.

| Metric | Scale | What It Measures | Status |
|--------|-------|-----------------|--------|
| **chrF++** | 0–100 | Character n-gram overlap between predicted and reference translations. Best surface metric for morphologically rich languages. Uses sacrebleu's native scoring. | ✅ All languages |
| **Exact match** | 0.0–1.0 | Proportion of entries where the prediction exactly matches the reference after normalization. | ✅ All languages |
| **FST acceptance** | 0.0–1.0 | Proportion of output words accepted by a finite-state transducer (morphological analyzer). Only computed when an FST binary is provided. | ✅ All languages with FST |
| **Equivalent match** | 0.0–1.0 | Fraction of entries matching the reference or an acceptable variant — accounting for word order, orthographic convention, and dialectal differences. | ⚡ CRK (generalizing) |
| **Semantic score** | 0.0–1.0 | Meaning preservation score — how well does the translation capture the intended meaning regardless of surface form? | ⚡ CRK (generalizing) |

Additional metrics are planned: **morphological accuracy**, **code-switching detection**, **terminology adherence**, and **hallucination detection**. See [Scoring Specification §2](/docs/network/specifications/scoring#2-metric-inventory) for the full metric inventory (six categories).

### How is the composite score calculated?

The composite is a weighted average of available metrics, normalized to a 0.0–1.0 scale. Weights are defined in two profiles:

- **Profile A** (languages with FST): 9 metrics, structural metrics (FST + morphological accuracy) carry 40% of the composite weight
- **Profile B** (languages without FST): 8 metrics, semantic and chrF++ carry equal top weight

When a metric is unavailable, its weight is redistributed proportionally across the remaining metrics. This means early-stage benchmarks (with only chrF++ and exact match available) still produce valid composites — the effective weights just reflect what's available.

**The full weight tables, normalization rules, and exclusion rationale are in [Scoring Specification §4](/docs/network/specifications/scoring#4-composite-score).** The harness code mirrors these tables in `mt_eval_harness/scoring.py`. chrF++ is normalized by dividing by 100 before weighting; code-switching and hallucination rates are inverted (lower = better).

### What are quality tiers?

Quality tiers are heuristic labels mapped to composite score ranges. They help communicate what a score *means* practically:

| Tier | Composite Range | Interpretation |
|------|----------------|----------------|
| **Baseline** | 0.00 – 0.30 | Below useful quality. Method needs significant improvement. |
| **Emerging** | 0.30 – 0.50 | Shows promise. Some translations are correct but inconsistent. |
| **Functional** | 0.50 – 0.70 | Usable for reference with human review. Not suitable for unreviewed deployment. |
| **Deployable** | 0.70 – 0.85 | Ready for production use with periodic review. Triggers ownership transfer eligibility. |
| **Fluent** | 0.85 – 1.00 | Near-native quality. Suitable for unsupervised deployment. |

### What's the difference between quality tiers and verification tiers?

**Quality tiers** describe *what the automated score means* (Baseline → Fluent). **Verification tiers** describe *who validated the result*:

| Verification Tier | What It Means |
|-------------------|---------------|
| **Self-benchmarked** | The submitter ran the harness themselves. Scores are plausible but unverified. |
| **Champollion Verified** | A maintainer reproduced the result using the submitted method configuration. |
| **Community Validated** | Bilingual speakers of the target language, qualified under the community's own protocol, reviewed a stratified sample of the output (≥30 entries, ≥2 reviewers) and ≥70% met the community's bar. Conferred only by the community's own testing; demotion by spot-audit is symmetric and equally public. |

A method can be "Deployable" quality but only "Self-benchmarked" verification — meaning the score looks great but nobody has independently confirmed it.

---

## Submission & Disqualification

### What gets my submission disqualified?

Your submission will be rejected or flagged if:

1. **Your method was exposed to evaluation data.** If you trained, fine-tuned, few-shot-prompted, or otherwise used any entries from the evaluation dataset, your scores are artificially inflated. This includes using the reference translations in your prompt.
2. **Your run card fails integrity checks.** The fingerprint must match the configuration. Tampered run cards are rejected.
3. **Your method doesn't implement the TranslationMethod protocol.** The harness expects `translate(entries, config) → results`. Custom integrations that bypass the harness are not accepted.

### Can I submit multiple times?

Yes. The leaderboard tracks all submissions. You can iterate — run dozens of experiments, only submit your best. Each submission records a unique fingerprint, so there's no ambiguity about which run produced which score.

### How do I get my score verified?

1. **Self-benchmarked (automatic):** Every submission starts here.
2. **Champollion Verified (automatic):** The server re-scores your submitted outputs against the sha-pinned reference corpus with the harness metric. When your score reproduces, the run promotes to Champollion Verified — the only tier the board ranks. If it doesn't reproduce, or a stored reference was altered, the run is disqualified.
3. **Community Validated:** Bilingual speakers of the target language, qualified under the community's own protocol, review a stratified sample of your method's output — at least 30 entries, at least 2 reviewers — and at least 70% must meet the community's bar. The tier is conferred only by testing the community runs itself, at its discretion, and can be revoked the same way: a failed spot-audit demotes the method just as publicly. This cannot be automated — it requires community engagement.

### Why don't you re-run everyone's method to verify it?

Because we can't afford to and don't need to. The server re-scores *everyone's* submitted outputs for free (that catches typed-in or edited scores). Actually re-running a model costs real compute, so we do it on a **sample** chosen by **reputation-weighted auditing**: a run is always re-run if it's high-stakes (it lights the first bridge to a whole language family) or anomalous (a too-good-to-be-true jump over the prior best), and from proven contributors it's spot-checked rarely. Reputation is earned only by passing these audits (or by an independent contributor corroborating your result) — never by volume — so fresh throwaway identities gain nothing. One caught fabrication zeroes a contributor's reputation, re-audits their entire verified history, and is recorded publicly, like a retraction. We do **not** claim your run "came through the harness" — for self-hosted compute that isn't server-verifiable — so validity rests on *reproducibility + reputation stake + corroboration*, not on attestation. See the [MT Evaluation rules](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing) for the full model.

### Is the submission API live?

Not yet. The `https://champollion.dev/api/leaderboard/submit` endpoint is aspirational. The current submission path is `mt-eval publish` — it uploads a run card from the harness output directory (`eval/logs/harness/`) straight to the leaderboard as *self-benchmarked (unverified)*.

---

## Models & Parameters

### What model should I use?

There's no single best model — it depends on the language pair, your budget, and your approach. General guidance:

| Language Type | Recommended Starting Point | Why |
|---------------|---------------------------|-----|
| **High-resource** (French, Spanish, Japanese) | `google/gemini-2.5-flash` or `gpt-4o-mini` | Fast, cheap, strong baseline |
| **Low-resource with some LLM coverage** (Quechua, Yoruba) | `google/gemini-2.5-pro` or `anthropic/claude-sonnet-4` | Larger models have better latent knowledge |
| **Polysynthetic / very low-resource** (Plains Cree, Inuktitut) | `google/gemini-2.5-pro` with coaching | Coaching data matters more than model choice. OMT-1600 includes some polysynthetic languages (e.g., CRK at R1 tier) but with standard BPE tokenization — benchmark it as a baseline in the Network. |

The eval harness uses OpenRouter, so any model available on OpenRouter can be benchmarked. See [openrouter.ai/models](https://openrouter.ai/models) for the available list.

### What temperature should I use?

Lower is generally better for translation:

| Temperature | Effect | Recommended For |
|-------------|--------|-----------------|
| **0.0 – 0.2** | Highly deterministic, consistent output | Production methods, final benchmarks |
| **0.3 – 0.5** | Some variation, occasionally more creative | Exploration, early iteration |
| **0.6+** | High variation, unpredictable | Not recommended for MT benchmarking |

Temperature is recorded in the run card, so different temperatures produce different fingerprints — they're treated as different experiments.

### Does coaching data help?

Yes, significantly — for low-resource languages. Coaching data (grammar rules, dictionary entries, style notes) is injected into the LLM system prompt. For Plains Cree, coached methods consistently outperform raw LLM methods for polysynthetic languages because general-purpose LLMs have limited polysynthetic exposure and no morphological awareness. Even OMT-1600, which was specifically trained for CRK, uses standard BPE tokenization that cannot represent polysynthetic morphology structurally. The coaching data provides the linguistic context the model lacks.

For high-resource languages (French, Spanish), coaching has less impact because the model already has strong baseline knowledge.

See [Coaching Data](https://champollion.dev/docs/concepts/coaching-data) for the full specification.

---

## FST & Morphological Validation

### What if there's no FST for my language?

Many languages don't have a finite-state transducer. That's OK — the harness works without one. The composite score uses Profile B weights (see [Scoring Specification §4.3](/docs/network/specifications/scoring#43-weight-tables)) which shift weight to semantic and surface metrics. FST acceptance is marked as `null` in the run card.

The main registries for existing FSTs:

| Registry | Coverage | URL |
|----------|----------|-----|
| **GiellaLT** | 100+ languages — the Sámi languages, Cree, Inuktitut, and many other Uralic and minority languages | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | Plains Cree, Tsuut'ina, Odawa | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
| **Apertium** | ~60 language pairs, mostly European | [apertium.org](https://apertium.org/) |
| **UniMorph** | Morphological paradigms for 150+ languages | [unimorph.github.io](https://unimorph.github.io/) |

### Can I build an FST?

Yes, but it's non-trivial. An FST encodes the morphological rules of a language — all valid word forms. Building one requires deep linguistic knowledge of the language. If you have access to a morphological grammar (e.g., from a linguistics department), it can be compiled into an FST using tools like [HFST](https://hfst.github.io/) or [Foma](https://fomafst.github.io/).

### How does FST gating work in practice?

The FST-gated pipeline works like this:

1. LLM generates a translation
2. Each word in the output is checked against the FST
3. Words the FST rejects are flagged as morphologically invalid
4. The method can retry with feedback ("the word X is not valid, try again")
5. After retries, remaining invalid words are logged

The FST acceptance rate measures how many words pass validation. See the [FST-Gated Pipeline Tutorial](/docs/network/tutorials/fst-gated-pipeline) for a complete worked example.

---

## Data & Datasets

### Can I contribute a dataset for a new language?

Yes. Minimum requirements from [Benchmark Specification §11](/docs/network/specifications/benchmark#11-extending-to-new-languages):

- **50 gold-standard entries** (source + verified reference translation)
- **30 development entries** (can overlap with gold standard for small corpora)
- **Community consent** (for Indigenous languages, explicit authorization from a governance body)
- **Provenance documentation** (where the data came from, what license applies)

New datasets open new leaderboard tracks automatically. See [For Language Communities](/docs/network/community/for-language-communities) for the contributor guide.

### What format should my dataset be in?

JSON with the canonical field names:

```json
{
  "name": "my-language-dev-v1",
  "language_pair": "en-xxx",
  "segment": "development",
  "version": "1.0",
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "[translation in target language]",
      "difficulty": 1,
      "domain": "general"
    }
  ]
}
```

See [Datasets](/docs/network/leaderboard/datasets) for the full schema and difficulty tier definitions.

---

## Sovereignty & Ownership

### Who owns a method built for an Indigenous language?

For Indigenous languages, methods that reach Deployable tier (composite ≥ 0.70) AND pass community validation trigger the [ownership transfer](/docs/network/sovereignty/ownership-transfer) process. Code ownership transfers from the researcher to the language community's governance organization.

The researcher retains:
- Publication rights (academic papers about the method)
- Credit on the leaderboard
- The right to apply the same *techniques* to other languages

The governance organization gains:
- Full ownership of the method code and coaching data
- Control over deployment (when, where, how) — and everything a deployment earns. Champollion is non-commercial and takes no share

### Can I use champollion for non-Indigenous languages without any sovereignty concerns?

Yes. For standard languages (French, Japanese, Spanish, etc.), there are no sovereignty considerations. Use champollion normally — translate, sync, publish as you wish. The sovereignty framework applies specifically to Indigenous and community-governed languages where data-governance principles — community ownership and control of language data, CARE, Te Mana Raraunga — require special consideration.

---

## See Also

- **[How It Works](https://champollion.dev/how-it-works)** — the full solution explainer
- **[Scoring Specification](/docs/network/specifications/scoring)** — the SSOT for all scoring logic (metrics, weights, tiers)
- **[Benchmark Specification](/docs/network/specifications/benchmark)** — evaluation protocol, corpus format, sovereignty
- **[Submit a Method](/docs/network/getting-started/submit-a-method)** — step-by-step quickstart
- **[Leaderboard Rules](/docs/network/leaderboard/rules)** — submission criteria
- **[Data Stewardship](/docs/network/sovereignty/data-sovereignty)** — corpora stay with their stewards; every license respected

