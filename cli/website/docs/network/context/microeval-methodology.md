---
sidebar_position: 4
title: 'Microeval: Language-Specific Evaluation for Machine Translation'
slug: '/network/context/microeval-methodology'
---

# Microeval: Language-Specific Evaluation Metrics for Machine Translation

***A methodology for building evaluation metrics tailored to individual languages using FSTs, dictionaries, and linguist-curated equivalence rules — and why the field needs it***

---

> *"The limits of my language mean the limits of my world."*
> — Ludwig Wittgenstein, *Tractatus Logico-Philosophicus* (1921)

---

## Introduction

The machine translation evaluation community has spent two decades searching for universal metrics — measures of translation quality that work across all languages, all domains, all typologies. This search has produced remarkable tools: BLEU (Papineni et al., 2002), chrF++ (Popović, 2017), COMET (Rei et al., 2020), MetricX (Juraska et al., 2023). For the ~20 languages that dominate WMT shared tasks, these tools work.

For the other ~7,000 languages, they don't.

This paper argues that **the search for universal metrics, when applied to low-resource and morphologically complex languages, is not just incomplete — it is the wrong paradigm**. We propose **microeval**: a methodology for building evaluation metrics tailored to individual languages using the best available linguistic tools — finite-state transducers, bilingual dictionaries, morphological analyzers, and linguist-curated equivalence rules.

Microeval is not a metric. It is a *practice* — a systematic process for constructing evaluation infrastructure that encodes language-specific knowledge. The practice produces metrics, which we collect under the framework name **LYSS** (Linguistically-informed Yield & Structural Scoring). But the contribution is the methodology, not any particular metric it produces.

This document is a companion to:
- [Measuring the Immeasurable](/docs/network/context/mt-evaluation-landscape) — the evaluation landscape survey, which positions LYSS among existing metrics
- [The Scoring Specification](/docs/network/specifications/scoring) — the technical spec for metric definitions, weights, and composite scoring
- [The Corpus Partnership Strategy](/docs/network/specifications/corpus-partnership) — the practical workflow for establishing evaluation corpora

Those documents describe *what* LYSS is and *where* it fits. This one addresses the deeper questions: *Why* is language-specific evaluation necessary? *How* do you build it for a new language? And *who* decides what counts as "correct"?

---

## Part 1: Why Universal Metrics Fail on Low-Resource Languages

### 1.1 The Universality Assumption

Every major MT evaluation metric since BLEU rests on an implicit assumption: that the *mechanisms* of translation quality are language-independent, even if the *parameters* differ. BLEU counts n-gram overlap. chrF++ counts character n-gram overlap. COMET trains a regression model on human judgments. All assume that the signal structure — what makes a translation "good" — can be captured by a language-agnostic algorithm, possibly fine-tuned on language-specific data.

For high-resource European language pairs, this assumption holds well enough. WMT metrics shared tasks demonstrate high human correlation for English↔German, English↔Czech, English↔Chinese. The metrics disagree on edge cases, but they agree on the distribution of quality.

For polysynthetic languages like Plains Cree (nêhiyawêwin), the assumption breaks down at multiple levels:

**Morphological opacity.** A single Cree verb can contain as much information as an entire English clause. The word *nikî-wîcihâw* ("I helped him/her") encodes person, number, animacy, direction, and tense in a single inflected form. An n-gram metric sees one token; a morphological analyzer sees six morphemes. Surface metrics cannot distinguish between a correctly inflected verb and a plausible-looking hallucination that violates animacy agreement — both are single tokens of similar character length.

**Free word order.** Cree has pragmatically free word order (Wolfart, 1973, §3.2). The sentences *atim niwâpamâw* and *niwâpamâw atim* ("I see the dog") are both grammatically correct — the choice is pragmatic, not syntactic. Any metric that penalizes word-order divergence from a reference translation will generate false negatives on every such pair.

**Morphological equivalence.** Cree has multiple valid orthographic representations of the same word (SRO variants, progressive/vowel-length alternations). The translations *nikî-atoskân* and *nikî-atoskên* may be dialectally equivalent. A string-match metric sees two different strings; a linguist sees the same word.

**Training data absence.** Neural metrics like COMET require training data — human quality judgments on translation pairs — to learn what "good" means. For Cree, this data does not exist. COMET can still produce scores (it falls back to its multilingual encoder), but those scores have not been validated against any Cree-speaking human's quality judgments. They are extrapolations from European language patterns, applied to a language with fundamentally different structure.

### 1.2 The Paradox of Low-Resource Evaluation

This creates a paradox:

> The languages that need machine translation most urgently are precisely the languages where the best evaluation tools are least reliable.

If we cannot measure translation quality for these languages, we cannot:
- Compare translation methods objectively
- Detect when a model hallucinates plausible-looking nonsense
- Track whether the field is making progress
- Hold MT system providers accountable for quality claims

The result is a **cascading failure**: no training data → no encoder coverage → no validated evaluation → no measurable progress → no incentive to invest → no training data.

Breaking this cycle requires evaluation methods that do not depend on the resources we don't have (training data, human judgments at scale, fine-tuned neural encoders). It requires methods that leverage the resources we *do* have.

### 1.3 What We Do Have

For many low-resource languages, decades of linguistic fieldwork have produced tools and resources that the MT evaluation community has largely ignored:

| Resource | What It Provides | Coverage |
|----------|-----------------|----------|
| **Finite-State Transducers (FSTs)** | Complete morphological analysis — every valid word form in the language | ~100+ languages via GiellaLT, Apertium, NRC |
| **Bilingual dictionaries** | Lemma-to-gloss mappings | Hundreds of languages (Wolvengrey 2001 for Cree: roughly 18,000–22,000 entries depending on edition and counting method) |
| **Morphological analyzers** | Part-of-speech tagging, lemmatization, inflectional paradigm generation | Dozens of languages with varying coverage |
| **Descriptive grammars** | Rules governing agreement, word order, animacy, obviation | Available for most documented languages |
| **Linguist expertise** | Community members who can identify correct vs. incorrect translations | Exists by definition for every living language |

These resources were built by computational linguists, field linguists, and language communities over decades — often with no connection to the MT evaluation community. The FST for Plains Cree was built at the University of Alberta by Antti Arppe and colleagues as a language documentation tool, not an evaluation metric. The GiellaLT infrastructure at UiT was built for minority language technology, not for WMT shared tasks.

**Microeval is the practice of turning these existing resources into evaluation metrics.**

---

## Part 2: The Microeval Methodology

### 2.1 Definition

**Microeval** is a systematic methodology for building machine translation evaluation metrics tailored to a specific language, using language-specific linguistic tools and resources. A microeval suite:

1. **Encodes language-specific knowledge** that cannot be captured by language-agnostic metrics
2. **Uses existing linguistic infrastructure** (FSTs, dictionaries, grammars) rather than requiring new training data
3. **Produces deterministic, interpretable scores** — every score can be traced to a specific linguistic judgment
4. **Is designed by linguists**, not just engineers — the variant classes, equivalence rules, and validation logic reflect linguistic expertise
5. **Complements rather than replaces** universal metrics — microeval fills the gaps, not the whole space

### 2.2 The Three-Layer Architecture

A complete microeval suite operates at three levels of analysis, from surface to semantics:

| Layer | Question Answered | Tool Used | LYSS Component |
|-------|------------------|-----------|----------------|
| **Morphological validity** | "Is each word a valid form in this language?" | Finite-state transducer (FST) | LYSS-fst |
| **Linguistic equivalence** | "Is this translation an acceptable variant of the reference?" | Deterministic linter with linguist-curated variant classes | LYSS-eq |
| **Semantic fidelity** | "Does this translation preserve the meaning of the source?" | FST lemmatization + dictionary glosses + content-word overlap | LYSS-sem |

These layers are **cumulative, not alternative**. A translation must pass all three to be considered fully correct. A hallucinated word fails at Layer 1. A dialectal variant that's correct but differs from the reference is caught at Layer 2. A translation that uses valid words in a valid order but means something different is caught at Layer 3.

### 2.3 How to Build a Microeval Suite for a New Language

This section describes the step-by-step process. We use Plains Cree (CRK) as the worked example and generalize where possible.

#### Step 1: Assess Available Resources

Before building anything, inventory what exists:

| Resource | Required for | How to Find It | Minimum Quality |
|----------|-------------|----------------|-----------------|
| FST | Layer 1 (LYSS-fst) | Check GiellaLT, Apertium, NRC catalogs | Must accept >90% of valid word forms in a test corpus |
| Bilingual dictionary | Layer 3 (LYSS-sem) | Check language documentation projects, Wiktionary, community resources | >5,000 entries with lemma-to-gloss mappings |
| Descriptive grammar | Layer 2 (LYSS-eq) | Published grammars, theses, community-authored references | Must document core morphological paradigms |
| Bilingual speakers | All layers (validation) | Community contacts, university language programs | Minimum 3 speakers for validation experiments |

**If no FST exists:** Skip Layer 1. The suite operates on Layers 2–3 only, or falls back to universal metrics (Profile B in LYSS scoring). This is not ideal, but it's better than nothing.

**If no dictionary exists:** Skip Layer 3 or use a reduced version with whatever vocabulary is available. A 500-entry dictionary is less useful than a 18,000-entry one, but it still provides signal.

#### Step 2: Configure the Morphological Validity Gate (LYSS-fst)

If an FST is available:

1. **Install the FST** using the language's analyzer binary (HFST `.hfstol` format for GiellaLT)
2. **Run a coverage test** on a representative corpus: what percentage of tokens does the FST recognize?
3. **Build an allowlist** for expected FST gaps: loanwords, proper nouns, neologisms, abbreviations
4. **Compute the baseline false rejection rate** — the percentage of valid words the FST incorrectly rejects
5. **Set the scoring threshold** — below what FST acceptance rate do we flag a translation as morphologically suspect?

The key metric is `fst_acceptance_rate`: the fraction of output words the FST recognizes. A rate of 0.85 means 85% of words are valid Cree morphology; 15% are either invalid, loanwords, or FST coverage gaps.

**Critical design decision:** The false rejection problem. An FST trained on formal literary language will reject valid colloquial forms. An FST with incomplete paradigm coverage will reject valid but rare inflections. The allowlist mitigates this, but cannot eliminate it. *This is why LYSS-fst alone is not sufficient* — it must be combined with Layers 2 and 3.

#### Step 3: Design the Variant Classes (LYSS-eq)

This is the most linguistically demanding step, and it cannot be automated. A linguist with expertise in the target language must identify:

**What kinds of differences between a candidate translation and a reference translation should be considered "acceptable"?**

For Plains Cree, we identified six variant classes:

| Variant Class | Linguistic Basis | Example |
|--------------|-----------------|---------|
| `WORD_ORDER` | Pragmatically free word order (Wolfart 1973 §3.2) | *atim niwâpamâw* ≡ *niwâpamâw atim* |
| `ORTHOGRAPHIC` | SRO spelling variants, vowel-length alternation | *nikî-atoskân* ≡ *nikî-atoskên* |
| `OPTIONAL_PARTICLE` | Grammatically optional discourse particles | *êkwa nikî-atoskân* ≡ *nikî-atoskân* |
| `LEMMA_SYNONYM` | Dictionary-attested synonyms | *wâpamêw* ≡ *kanawâpamêw* (for "sees") |
| `PROGRESSIVE_AMBIGUITY` | Multiple valid progressive forms | *ê-atoskêt* ≡ *atoskêw* |
| `INCLUSIVE_EXCLUSIVE` | First-person plural distinction not in English | *ki-wîcihânaw* ≡ *ni-wîcihânân* |

**These classes are language-specific.** Another language would have different classes — Turkish might have classes for vowel harmony variants, Japanese for honorific register alternation, Inuktitut for dialectal suffix variation.

**The design process:**
1. Collect 100+ translation pairs (source + reference + candidate)
2. Identify all cases where the candidate is different from the reference but a bilingual speaker would consider it correct
3. Categorize the differences — look for patterns that recur across multiple pairs
4. Formalize each pattern as a deterministic rule (regex, set operation, or FST transduction)
5. Validate with 3+ bilingual speakers: for each variant class, do they agree it's acceptable?
6. Iterate: some classes will need refinement, others will need to be split or merged

#### Step 4: Build the Semantic Validator (LYSS-sem)

The semantic validator answers: "Does this translation mean the same thing as the reference?" It operates in four stages:

1. **Lemmatize both translations** using the FST (extract root forms, strip inflection)
2. **Map lemmas to glosses** using the bilingual dictionary (Cree lemma → English gloss)
3. **Compare the gloss sets** — do the candidate's glosses overlap with the reference's glosses?
4. **Check structural constraints** — does the candidate violate known grammar rules (animacy agreement, verb form, person marking)?

The validator produces verdicts: `EXACT_MATCH`, `VALID`, `GRAMMAR_ISSUES`, `PARTIAL`, `INCOMPLETE`, `WRONG`, `NO_OUTPUT`. Each verdict is deterministic and traceable — you can explain *why* a translation received a given verdict by examining which stage flagged it.

**Minimum viable version:** If you have an FST and a dictionary, you can build a simplified semantic validator that only does lemma-gloss overlap (stages 1–3). Stage 4 (grammar checking) requires more linguistic engineering but adds significant value for morphologically complex languages.

#### Step 5: Integrate with the Evaluation Harness

The microeval suite is packaged as a set of metric plugins that plug into the evaluation harness:

1. Each metric implements the `MetricPlugin` protocol: `compute(entry) → dict`, `aggregate(results) → dict`
2. The plugin discovery system auto-detects language-specific plugins based on the target language code
3. Scores are fed to the composite scoring function, which combines microeval metrics with universal metrics using language-specific weight profiles

### 2.4 Minimum Viable Microeval

Not every language needs all three layers immediately. Here's the minimum useful configuration at each level:

| Configuration | What You Need | What You Get | Time to Build |
|--------------|--------------|-------------|---------------|
| **LYSS-fst only** | FST + allowlist | Morphological validity gate — catches hallucinated word forms | 1–2 weeks |
| **LYSS-fst + LYSS-eq** | FST + 3–6 variant classes + linguist time | Validity gate + equivalence detection — reduces false negatives | 4–8 weeks |
| **Full LYSS** | FST + variant classes + dictionary + semantic validator | Complete language-specific evaluation | 8–16 weeks |

The recommendation is to start with LYSS-fst (fast, high impact, requires only an FST that probably already exists) and add layers incrementally.

---

## Part 3: The False Rejection Problem

### 3.1 What It Is

Every microeval metric has a false rejection rate: the probability that a correct translation is scored as incorrect.

For LYSS-fst, false rejection occurs when:
- The FST doesn't cover a valid word form (incomplete paradigm tables)
- The translation contains a loanword the FST doesn't recognize
- The translation uses a neologism or brand name
- The translation uses a dialectal form not in the FST's lexicon
- The translation contains a proper noun not in the allowlist

For LYSS-eq, false rejection occurs when:
- The translation uses an acceptable variant not covered by any variant class
- A new variant class is needed but hasn't been identified yet

For LYSS-sem, false rejection occurs when:
- A lemma is not in the dictionary
- A valid translation uses a paraphrase strategy that doesn't map to the reference's lemma set

### 3.2 Why It Matters More Than False Acceptance

In evaluation, false rejection is worse than false acceptance. A false rejection means a *correct* translation is scored as *wrong* — this discourages builders who are doing good work, and it undermines trust in the metric. A false acceptance means a *wrong* translation is scored as *correct* — this is bad, but it's caught by other metrics in the composite.

False rejection compounds: if LYSS-fst has a 10% false rejection rate per word, and a sentence has 5 words, the probability that at least one word is falsely rejected is ~41%. This means nearly half of all sentences will have their FST acceptance rate reduced by at least one word — not because the translation is wrong, but because the FST is incomplete.

### 3.3 Mitigation Strategies

| Strategy | Mechanism | Effectiveness |
|----------|----------|---------------|
| **Allowlists** | Whitelist known loanwords, proper nouns, abbreviations | High for known gaps, zero for unknown gaps |
| **Fuzzy matching** | Accept words within edit distance 1 of a known form | Catches typos and minor orthographic variants |
| **Confidence scoring** | Weight FST results by paradigm completeness | Requires paradigm coverage metadata |
| **Category-specific thresholds** | Different thresholds for different domains (medical may have more loanwords) | Requires domain-tagged corpora |
| **Community-maintained allowlists** | Speakers submit words the FST should accept | Most sustainable long-term; requires community engagement infrastructure |

### 3.4 Measuring the Rate

The false rejection rate must be measured empirically, on a representative corpus:

1. Take a corpus of 500+ known-valid Cree sentences (textbooks, reviewed translations)
2. Run every word through the FST
3. For every word the FST rejects, have a bilingual speaker classify it: valid word the FST missed, or genuinely invalid?
4. `false_rejection_rate = valid_but_rejected / total_valid_words`

This measurement is one of the required validation experiments (Scoring Spec §1.6).

---

## Part 4: Who Decides What's "Correct"?

### 4.1 The Political Dimension of Evaluation

Evaluation metrics are not neutral instruments. Every metric embeds a theory of what "correct translation" means, and that theory has consequences:

- An FST built from literary Cree will penalize colloquial Cree. This is a *political* choice about which register of the language is valued.
- A variant class that accepts one dialectal form but not another implicitly standardizes the language. Standardization is a political act with a long colonial history.
- A semantic validator that requires exact lemma overlap penalizes creative paraphrase — an important translation strategy that skilled translators use deliberately.

Microeval makes these choices *explicit*. Every variant class, every allowlist entry, every semantic equivalence rule is a discrete, documented, reviewable decision. This is a feature, not a bug: it means the community can inspect, challenge, and modify the rules that govern how their language is evaluated.

### 4.2 Community Governance of Evaluation Rules

For Indigenous languages specifically, evaluation decisions must be governed by the language community, not by external researchers or engineers. This is not just an ethical principle (though it is) — it's a correctness requirement. Only fluent speakers can determine whether a variant is acceptable.

The governance model:

1. **Researchers propose** variant classes, allowlist entries, and semantic rules based on linguistic analysis
2. **Speakers review** each proposal and approve, reject, or modify it
3. **Approved rules** are committed to the codebase with speaker attribution
4. **Disputed rules** are flagged for community discussion — they are excluded from scoring until resolved
5. **The community can revoke** any rule at any time by removing it from the approved set

This model requires infrastructure (the evaluation harness, version control, the speaker validation protocol) and relationships (trust between researchers and community members). Building this infrastructure is part of the microeval methodology.

### 4.3 Dialectal Variation

The hardest governance question: when two dialects of a language disagree about a form, which is "correct"?

Microeval's answer: **both are correct.** Dialectal variants are represented as additional variant classes with dialect tags. The composite score can be computed per-dialect or across dialects, depending on what the evaluation is trying to measure. This supports the expansion of FST-based evaluation while explicitly cautioning against insisting upon rigid perfection or artificial standardization.

This requires the corpus to be dialect-tagged and the variant classes to be dialect-aware. It also requires speakers from multiple dialects to participate in validation. The Corpus Partnership Strategy document addresses these requirements.

---

## Part 5: Relationship to Prior Art

### 5.1 What Microeval Is NOT

| Claim We Are NOT Making | Why Not |
|------------------------|---------|
| "Universal metrics are useless" | They provide essential baselines and cross-language comparability. Microeval supplements, not replaces. |
| "Neural metrics can't work for LRL" | They can — with fine-tuning on language-specific data. But that data rarely exists. Microeval works *now*. |
| "FST-based evaluation is novel" | It isn't. FSTs have been used in NLP for decades, and FST/rule-based pipelines have been applied to low-resource MT before (e.g. the AmericasNLP-2024 Quechua hybrid). Our contribution is *integration* — wiring an FST validity check into public, per-pair, verifier-backed measurement — not the idea itself. |
| "LYSS is better than COMET" | We don't know — we haven't done the human correlation study. We believe LYSS is more *informative* for polysynthetic languages, but we cannot claim it's more *accurate* until we have evidence. |

### 5.2 Closest Prior Art

| Work | Relationship to Microeval |
|------|--------------------------|
| **MorphEval** (Sánchez-Cartagena & Toral, 2024) | Contrastive tests for morphological phenomena — complementary. MorphEval tests whether systems *can* produce morphology; LYSS tests whether they *did*. |
| **CheckList** (Ribeiro et al., 2020) | Behavioral testing methodology for NLP — analogous paradigm. CheckList is a methodology; microeval is also a methodology, applied to evaluation rather than testing. |
| **HyTER** (Dreyer & Marcu, 2012) | Meaning-equivalent lattices — closest conceptual parallel to LYSS-eq. HyTER enumerates paraphrases; LYSS-eq enumerates morphological variants. HyTER requires manual lattice construction per sentence; LYSS-eq rules apply corpus-wide. |
| **Apertium coverage** | Uses FST coverage as a proxy for MT output quality — directly anticipates LYSS-fst. Not formalized as a metric or integrated into a scoring framework. |
| **FUSE** (AmericasNLP 2025) | Feature-based evaluation for Indigenous American languages — most similar in spirit. FUSE proposes linguistic features as evaluation dimensions; LYSS implements specific features for specific languages. Head-to-head comparison is needed. |
| **AfriCOMET** (Wang & Adelani, 2024) | Fine-tuned COMET for African languages — demonstrates that neural metrics *can* be adapted. Microeval is the rule-based complement for languages where fine-tuning data doesn't exist. |

### 5.3 The Key Distinction

All prior art in morphology-aware evaluation either:
1. **Proposes a general framework** without implementing it for specific languages (FUSE, CheckList)
2. **Implements for high-resource languages** where training data exists (MorphEval focuses on European pairs)
3. **Fine-tunes neural metrics** which requires the data we don't have (AfriCOMET)

Microeval is specifically designed for the case where:
- Linguistic tools (FSTs, dictionaries) exist
- Training data for neural metric fine-tuning does not
- The language's morphological complexity defeats surface metrics
- The evaluation must be operational *now*, not after a data collection campaign

---

## Part 6: Open Questions and Honest Limitations

### 6.1 Unresolved Questions

1. **Do LYSS metrics correlate with human quality judgments?** We don't know. The required human correlation study (200+ sentence pairs, 3+ bilingual speakers) has not been conducted. Until it has, LYSS scores are engineering estimates, not validated quality measurements.

2. **How do LYSS metrics behave as languages change?** Living languages evolve — new loanwords, shifting dialects, emerging neologisms. FSTs and variant classes must be maintained. What is the maintenance burden? We don't know.

3. **What is the minimum FST quality for useful LYSS-fst?** If an FST covers only 60% of the lexicon, is LYSS-fst still useful, or does the noise overwhelm the signal? We need empirical evidence.

4. **Can microeval work for non-morphological challenges?** Languages with tonal distinctions, click consonants, or logographic scripts present evaluation challenges that FSTs don't address. Microeval may not apply — or it may require different tools.

5. **How do we handle the cold-start problem?** Building a microeval suite requires linguistic expertise. For languages with no active computational linguistics community, who does the work?

### 6.2 Honest Limitations of LYSS

| Limitation | Severity | Mitigation |
|-----------|----------|-----------|
| No human correlation data | 🔴 Critical | Required validation experiment #1 |
| FST false rejection rate unmeasured | 🔴 Critical | Required validation experiment #2 |
| Only implemented for one language (CRK) | 🟡 Significant | Second-language port (North Sámi) planned |
| Variant classes may be incomplete | 🟡 Significant | Community review + ongoing addition |
| Semantic validator requires spaCy | 🟡 Significant | Optional dependency; graceful degradation |
| Dictionary coverage affects LYSS-sem quality | 🟡 Significant | Minimum dictionary size requirements documented |
| Cannot detect fluency or naturalness | 🟡 Significant | Requires human evaluation or neural metrics |
| Requires linguistic expertise to extend | 🟡 Significant | Methodology documentation (this paper) reduces barrier |

### 6.3 The Path Forward

> *"If we only focus on what generalizes, we will inevitably forget about where it doesn't — and lose these languages and all their knowledge and wisdom."*

Microeval is not a solution to the evaluation problem. It is a practice — a discipline of paying attention to what makes each language different, and encoding that attention in working code. The practice is laborious, language-specific, and never finished. But it produces something the universal-metric paradigm cannot: evaluation that speaks the language it evaluates.

---

## Appendix A: Key Papers

| Paper | Year | Contribution | Relevance |
|-------|------|-------------|-----------|
| Papineni et al., "BLEU" | 2002 | Foundational n-gram metric | Baseline universal metric |
| Popović, "chrF++" | 2017 | Character n-gram metric | Best surface metric for morphologically rich languages |
| Rei et al., "COMET" | 2020 | Neural evaluation framework | Universal neural metric |
| Dreyer & Marcu, "HyTER" | 2012 | Meaning-equivalent semantics | Conceptual predecessor to LYSS-eq |
| Burlot & Yvon, "MorphEval" | 2017 | Morphological evaluation | Contrastive morphological testing |
| Ribeiro et al., "CheckList" | 2020 | Behavioral testing for NLP | Methodological paradigm |
| Sánchez-Cartagena & Toral, "MorphEval" | 2024 | Morphological capabilities evaluation | Closest diagnostic complement |
| Wang & Adelani, "AfriCOMET" | 2024 | Adapted neural metric for African languages | Demonstrates the need for language-specific evaluation |
| Lindén et al., "HFST" | 2011 | Finite-state morphology framework | Infrastructure for LYSS-fst |
| Wolfart, "Plains Cree" | 1973 | Definitive Cree grammar | Linguistic authority for CRK microeval |
| Wolvengrey, "Cree: Words" | 2001 | Plains Cree dictionary | Resource underlying LYSS-sem |
| Carroll et al., "CARE Principles" | 2020 | Indigenous data governance | Governance framework for microeval |

## Appendix B: LYSS Component Summary

| Component | Metric Name | What It Measures | Required Resources | Implementation Status |
|-----------|------------|------------------|-------------------|-----------------------|
| LYSS-fst | `fst_acceptance_rate` | Morphological validity of output words | GiellaLT FST | ✅ Operational (CRK) |
| LYSS-eq | `equivalent_match_rate` | Acceptable-variant detection | Linguist-curated variant classes | ✅ Operational (CRK, 6 classes) |
| LYSS-sem | `semantic_score` | Meaning preservation via lemma-gloss overlap | FST + bilingual dictionary + spaCy | ✅ Operational (CRK, requires spaCy) |

## Appendix C: Languages with GiellaLT FST Coverage

The following languages have FSTs available through GiellaLT and are candidates for LYSS-fst integration:

<!-- This list should be populated with actual GiellaLT coverage data. -->
<!-- See: https://github.com/giellalt -->

| Language | ISO 639-3 | FST Maturity | LYSS-fst Feasibility |
|----------|-----------|-------------|---------------------|
| Plains Cree | crk | Production | ✅ Operational |
| Northern Sámi | sme | Production | 🟡 Planned (first port) |
| Southern Sámi | sma | Production | 🟡 Candidate |
| Lule Sámi | smj | Production | 🟡 Candidate |
| Inari Sámi | smn | Production | 🟡 Candidate |
| Skolt Sámi | sms | Production | 🟡 Candidate |
| Finnish | fin | Production | 🟡 Candidate |
| Inuktitut | iku | Beta | 🟡 Needs assessment |
| Basque | eus | Beta | 🟡 Needs assessment |
| Welsh | cym | Beta | 🟡 Needs assessment |
