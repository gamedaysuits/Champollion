---
sidebar_position: 8
title: 'Speaker Validation Protocol'
slug: '/network/specifications/speaker-validation'
---

# Speaker Validation Protocol

> **Purpose.** This document defines exactly what we need from bilingual Cree–English speakers to validate the LYSS evaluation metrics. Without this validation, our automated scores are engineering estimates, not proven quality measurements. This is the single most important gap in the project.
>
> **Audience.** Community partners, potential collaborators, grant reviewers, and the project team.


---

## 1. Why We Need Speakers

The LYSS evaluation framework (Linguistically-informed Yield & Structural Scoring) computes automated quality scores for English → Plains Cree translations. It uses three core signals:

- **LYSS-fst**: Does the output contain valid Cree words? (checked by the GiellaLT finite-state transducer)
- **LYSS-eq**: Is the output an acceptable variant of the reference translation? (checked by the linter's equivalence classes)
- **LYSS-sem**: Does the output preserve the meaning of the source? (checked by the semantic validator)

These metrics produce numbers. **We do not know if those numbers mean anything.** The FST can reject valid words it doesn't recognize (loanwords, neologisms, proper nouns). The linter may miss valid equivalences or accept invalid ones. The semantic validator may misjudge meaning. Until bilingual speakers tell us whether our automated scores match their human judgment of translation quality, we are guessing.

Every major MT evaluation metric (BLEU, COMET, chrF++) was validated by comparing automated scores against thousands of human quality assessments. We need the same — at a smaller scale, because our resources are limited, but with the same rigor.

---

## 2. What We Need: Three Tasks

### Task A: Translation Quality Rating (Primary — ~8 hours total)

**What:** Rate 200 machine-generated English → Cree translations on two scales.

**Who:** 3+ bilingual Plains Cree–English speakers with reading fluency in SRO (Standard Roman Orthography).

**How it works:**

1. We provide a spreadsheet or web form with 200 rows. Each row has:
   - The English source sentence
   - A machine-generated Cree translation
   - (Optionally) a reference Cree translation for comparison

2. For each translation, the speaker rates two things:

   **Adequacy** (does it say the right thing?):
   | Score | Label | Meaning |
   |-------|-------|---------|
   | 1 | None | The translation has nothing to do with the source |
   | 2 | Little | A few words match but the overall meaning is wrong |
   | 3 | Much | The core meaning is there but important parts are missing or wrong |
   | 4 | Most | Almost everything is correct, minor meaning gaps |
   | 5 | All | The translation fully conveys the meaning of the source |

   **Fluency** (does it sound like real Cree?):
   | Score | Label | Meaning |
   |-------|-------|---------|
   | 1 | Incomprehensible | This is not Cree |
   | 2 | Disfluent | Individual words might be Cree but the sentence is broken |
   | 3 | Non-native | Understandable but clearly not how a Cree speaker would say it |
   | 4 | Good | Natural-sounding with minor awkwardness |
   | 5 | Flawless | A Cree speaker could have written this |

3. Optionally, the speaker can add a free-text note explaining their rating (e.g., "wrong animate/inanimate agreement on the verb," "this is th-dialect but I rate based on y-dialect").

**Time estimate:** ~2.5 minutes per translation × 200 translations = ~8 hours. Can be split across multiple sessions (e.g., 4 × 2-hour sessions over 2 weeks).

**Compensation:** $50–65 CAD/hour (matching BENCHMARK_SPEC §10.3 speaker compensation rates). Total per speaker: $400–520 CAD. For 3 speakers: **$1,200–1,560 CAD**.

**What we do with it:** We compute the correlation between our automated LYSS scores and the speaker ratings. If LYSS-fst correlates with fluency ratings and LYSS-sem correlates with adequacy ratings, the metrics are validated. If not, we know where to fix them.

---

### Task B: Linter Equivalence Validation (~2 hours)

**What:** Review 50 pairs of Cree translations that our linter classifies as "equivalent" and tell us whether they actually mean the same thing.

**Who:** 1–2 bilingual speakers (can be the same speakers as Task A).

**How it works:**

1. We provide 50 pairs. Each pair has:
   - The English source
   - Translation A (the reference)
   - Translation B (a variant our linter says is equivalent)
   - The equivalence reason (e.g., "word order permutation," "orthographic variant," "optional particle removed")

2. For each pair, the speaker answers:
   - **Same meaning?** Yes / No / Depends on context
   - **Both natural?** Yes / A is better / B is better / Neither is natural
   - **Notes** (optional free text)

**Time estimate:** ~2 minutes per pair × 50 pairs = ~2 hours.

**Compensation:** $50–65 CAD/hour × 2 hours = **$100–130 CAD per speaker**.

**What we do with it:** We compute the precision of each equivalence class. If speakers say 90% of "word order" equivalences are genuinely equivalent, that class is validated. If they say 40% of "lemma synonym" equivalences are wrong, we know to fix or remove that class.

---

### Task C: FST False Rejection Review (~1.5 hours)

**What:** Review 100 Cree words that the FST analyzer rejects (says are not valid Cree words) and tell us whether they are actually valid.

**Who:** 1 bilingual speaker with strong Cree vocabulary knowledge.

**How it works:**

1. We run the FST analyzer on our 436-entry EdTeKLA dev corpus (`textbook_dev.json`) and collect every word it rejects.
2. We present up to 100 rejected words to the speaker with their sentence context.
3. For each word, the speaker answers:
   - **Is this a valid Cree word?** Yes / No / Unsure
   - **If yes, what kind?** Established word / Loanword / Name / Dialectal form / Neologism / Other
   - **Notes** (optional)

**Time estimate:** ~1 minute per word × 100 words = ~1.5 hours.

**Compensation:** $50–65 CAD/hour × 1.5 hours = **$75–100 CAD**.

**What we do with it:** We compute the FST's false rejection rate. If the FST rejects 50 words and speakers say 30 of them are valid, the false rejection rate is 60% — unacceptably high, requiring a loanword/exception allowlist. If speakers say only 5 are valid, the false rejection rate is 10% — the metric is reliable.

---

## 3. Total Speaker Commitment

| Task | Speakers Needed | Hours per Speaker | Cost per Speaker | Total Cost |
|------|----------------|-------------------|-----------------|------------|
| A: Quality Rating | 3 | ~8 hours | $400–520 | $1,200–1,560 |
| B: Linter Validation | 2 | ~2 hours | $100–130 | $200–260 |
| C: FST Review | 1 | ~1.5 hours | $75–100 | $75–100 |
| **Total** | **3 speakers** | **~11.5 hours (max per speaker)** | **$575–750 (max)** | **$1,475–1,920** |

If the same 3 speakers do all tasks: **~11.5 hours each over 2–4 weeks, $575–750 each**.

A single speaker doing only Task A would commit **~8 hours over 2 weeks for $400–520**.

---

## 4. Speaker Qualifications

**Required:**
- Bilingual in Plains Cree and English
- Reading fluency in SRO (Standard Roman Orthography)
- Comfortable rating translations on a structured scale

**Preferred:**
- Experience with y-dialect (the dialect used in our reference corpus from EDTeKLA)
- Teaching or translation experience (provides calibrated quality judgment)
- Familiarity with different registers (formal, educational, conversational)

**Not required:**
- Technical or NLP knowledge (we provide all tools and context)
- Computational skills (the rating interface will be a simple spreadsheet or web form)
- Previous involvement with the Champollion project

---

## 5. Data Governance {#5-data-governance}

All speaker contributions are governed by the project's sovereignty-aspirant data policies:

- **Ownership:** Speakers' quality ratings remain their intellectual contribution. They are credited by name (or anonymously, at their choice) in any publication.
- **Control:** Speakers can withdraw their ratings at any time. Withdrawal removes their data from all analyses.
- **Access:** Rating data is stored on infrastructure controlled by the community governance organization (when established) or on the speaker's preferred platform.
- **Possession:** Raw rating data is never published. Only aggregate statistics (correlations, inter-annotator agreement) appear in publications.
- **Compensation:** Speakers are paid for their time regardless of whether we use their ratings. Payment is not contingent on results.

---

## 6. What Speakers Get {#6-what-speakers-get}

Beyond compensation:

- **Co-authorship** on any publication using their ratings (if desired)
- **Acknowledgment** in all project documentation
- **Early access** to the evaluation tools and results
- **Input** on how the metrics are used — if a speaker says "your linter is wrong about X," we fix the linter
- **Veto power** over publication of results they find problematic

---

## 7. How to Get Started {#7-how-to-get-started}

If you are a bilingual Cree–English speaker interested in participating, or if you know someone who might be:

1. **Contact us** at [project email/contact] — no commitment required, just a conversation
2. **We explain the tasks** in plain language (no jargon)
3. **You choose which tasks** you're interested in (A, B, C, or any combination)
4. **We set a schedule** that works for you (2-hour blocks, flexible timing)
5. **You rate translations** via spreadsheet or web form — from anywhere, on your own time
6. **We pay promptly** — within 2 weeks of completing each task block

---

## 8. What Happens After

With speaker validation data, we can:

1. **Publish the metric correlations** — proving (or disproving) that LYSS scores reflect human judgment
2. **Recalibrate the metrics** — adjusting weights, thresholds, and equivalence classes based on speaker feedback
3. **Fix the linter** — removing false equivalences, adding missing ones
4. **Fix the FST allowlist** — adding valid words the FST incorrectly rejects
5. **Submit to an academic venue** — with speakers as co-authors, establishing LYSS as a validated metric for polysynthetic language MT evaluation

Without speaker validation, LYSS remains an engineering tool. With it, LYSS becomes a scientifically grounded evaluation metric. That is the difference between "we built something" and "we proved it works."


## Where this leads on this site

Speaker validation is one stage of a larger pipeline: the
[Corpus Partnership](/docs/network/specifications/corpus-partnership)
workflow is where these tasks fit into building an evaluation corpus, and
[How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid)
is the plain-language version of the rates and terms above.
