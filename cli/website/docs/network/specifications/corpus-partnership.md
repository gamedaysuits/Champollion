---
sidebar_position: 9
title: 'Corpus Partnership Strategy'
slug: '/network/specifications/corpus-partnership'
---

# Corpus Partnership Strategy: Establishing Evaluation Corpora Through Academic Linguistics Departments

Building a *training* corpus for a low-resource language takes hundreds of
thousands of sentence pairs — far too many to check, so quality varies in
ways nobody sees until a model trained on them fails. An *evaluation*
corpus takes a few hundred pairs, every one of them reviewed by someone who
knows the language, and it never goes stale: each new model or method that
appears is measured against it. This document is the workflow for building
that second, dramatically cheaper thing — the one deliverable where a
department's expertise reaches every single sentence — and for what happens
after: with an evaluation standard in place, a
[posted prize](/docs/network/specifications/prizes) turns your language
into a target that any method builder in the world can aim at, and the
public leaderboard measures every attempt.

> **Purpose.** The complete workflow for establishing a machine translation evaluation corpus through a linguistics department partnership: what the department delivers, what the corpus must look like, how it is cryptographically sealed, how sandbox evaluation works, and what the department gets in return. This is the document you bring to a meeting with a potential academic partner.
>
> **Audience.** Department heads, principal investigators, research coordinators, and Indigenous language program directors at universities with active language documentation or NLP programs.
>
> **Companion documents:**
> - [Corpus Design Framework](/docs/network/specifications/corpus-design) — the methodology behind valid, reliable evaluation corpora
> - [Prize Specification](/docs/network/specifications/prizes) — the incentive half: posting a prize against your sealed set
> - [Registering Corpora](/docs/network/sovereignty/registering-corpora) — how a corpus joins the Network without leaving your hands
> - [Speaker Validation Protocol](/docs/network/specifications/speaker-validation) — the ask for bilingual speakers to *mark* existing translations (quality rating, linter validation, FST review)
> - [Benchmark Specification](/docs/network/specifications/benchmark) — the full technical spec for corpora, run cards, and evaluation protocols
> - [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — Indigenous data-sovereignty principles, CARE, and why ownership transfer matters

---

## 1. What This Partnership Produces

A **sealed evaluation corpus**: a curated set of parallel text pairs (source language → target language) that becomes the ground truth for measuring machine translation quality. Methods are tested against this corpus in a sandbox — developers never see the test data.

The partnership produces three artifacts:

| Artifact | What It Is | Who Controls It |
|----------|-----------|-----------------|
| **Development corpus** | 100–200+ public parallel text pairs for method development | Published openly (CC BY-NC-SA 4.0 or equivalent) |
| **Gold-standard test set** | 50–150 secret parallel text pairs for official evaluation | Community governance org (cryptographically sealed) |
| **Diagnostic test suite** | 10–50 targeted contrastive pairs testing specific linguistic phenomena | Published openly |

Together that is 160–400 pairs — a corpus one research group can actually
curate to professional standard, against the hundreds of thousands a
training corpus would demand. The development corpus enables anyone to
build translation methods. The gold-standard set ensures those methods are
tested honestly. The diagnostic suite catches specific failure modes
(e.g., "can this system handle obviation?").

---

## 2. What the Department Needs to Do

### Phase 1: Corpus Design (2–4 weeks, researcher time)

**Lead:** PI or postdoc with expertise in the target language.

1. **Select source material domains.** Choose 4–6 real-world domains where translation is actually needed by the language community. Our taxonomy supports 16 domains (see Benchmark Spec §2.7):

   | Priority | Domain | Why |
   |----------|--------|-----|
   | 🔴 High | `edu` — Educational | Textbooks, curricula — direct community need |
   | 🔴 High | `gov` — Government | Band council documents, policy — practical daily need |
   | 🔴 High | `medical` — Health | Clinic intake forms, health info — safety-critical |
   | 🟡 Medium | `conv` — Conversational | Everyday speech — establishes baseline fluency |
   | 🟡 Medium | `legal` — Legal | Rights documents, treaties — community significance |
   | 🟢 Lower | `literary` — Literary/Cultural | Stories, oral histories — cultural preservation |

2. **Draft a corpus design document** specifying:
   - Target size per segment (development, gold_standard, diagnostic)
   - Difficulty tier distribution (see §3.3 below)
   - Register and domain coverage
   - Source sentence selection criteria (no synthetic text, no Bible-only)
   - Speaker recruitment plan

3. **Submit the design to us for review.** We validate it against the corpus schema (Benchmark Spec §2) and return feedback within 1 week.

### Phase 2: Source Sentence Creation (4–8 weeks, speaker time)

**Lead:** Research coordinator working with bilingual speakers.

1. **Generate or select source sentences** across the planned domains and difficulty tiers. Sources can be:
   - Existing published bilingual materials (textbooks, government documents)
   - Newly elicited sentences designed to cover specific linguistic phenomena
   - Adapted from real-world documents (band council agendas, clinic forms, educational materials)

2. **Each source sentence must have:**
   - Domain tag (from the 16-code taxonomy)
   - Register tag (conversational, formal, technical, ceremonial, educational)
   - Context tag (greeting, declaration, question, instruction, narrative, label, error)
   - Estimated difficulty tier (1–5, see §3.3)
   - Provenance tag (textbook, elicited, corpus, gold_standard)

3. **Translate each source sentence** into the target language, performed by bilingual speakers. Multiple reference translations per entry are valuable but not required.

4. **Optionally, add morphological analysis** for each reference translation:
   - Interlinear gloss (morpheme-by-morpheme breakdown)
   - FST tag string (if an FST exists for the language)
   - Translator notes on dialectal variants, ambiguity, or cultural context

### Phase 3: Quality Assurance (2–4 weeks)

**Lead:** Linguist with target language expertise.

1. **Cross-review.** Each translation should be reviewed by at least one additional bilingual speaker who did not produce the original translation. The reviewer checks:
   - Is the translation accurate?
   - Is it natural-sounding?
   - Is the difficulty rating correct?
   - Are there acceptable variants that should be noted?

2. **Run through our schema validator.** We provide a script that validates the corpus against the entry schema (Benchmark Spec §2.2). It checks:
   - Required fields present
   - Domain codes valid
   - Difficulty tiers are integers 1–5
   - No duplicate IDs
   - Character encoding (UTF-8 NFC normalization)

3. **If an FST exists for the language,** run the reference translations through it. Every word in the reference should be FST-valid. Words that are not (loanwords, neologisms, proper nouns) should be documented in an allowlist.

### Phase 4: Segmentation and Sealing (1 week, our engineering)

**Lead:** Champollion team, with department review.

1. **Stratified split.** We split the corpus into segments using deterministic random sampling (seed documented, reproducible):

   | Segment | Target Size | Access |
   |---------|------------|--------|
   | `development` | 60% of entries (min 100) | Public |
   | `gold_standard` | 30% of entries (min 50) | Secret, sealed |
   | `held_out` | 10% of entries (min 10) | Secret, sealed, never used until activated |

   The split preserves difficulty tier distribution (stratified sampling) so each segment has proportional representation across tiers.

2. **Cryptographic sealing** of the gold_standard and held_out segments:

   ```
   1. SHA-256 hash of each entry (source + reference + metadata)
   2. SHA-256 hash of the complete segment file
   3. Segment file encrypted with AES-256-GCM
   4. Encryption key split using Shamir Secret Sharing (2-of-3 threshold)
   5. Key shares distributed to:
        - Share 1: Community governance organization
        - Share 2: Academic department partner
        - Share 3: Champollion project (escrow)
   6. Hash manifest published to a public commit (proves the corpus existed
      at a specific time without revealing its contents)
   ```

3. **The development segment** is committed to the public repository and published with full licensing.

4. **The diagnostic segment** is also public — it tests specific linguistic phenomena (see §3.4).

### Phase 5: Integration and Launch (1–2 weeks, our engineering)

1. **Harness configuration.** We add the language to the evaluation harness:
   - Language card created or verified
   - Corpus registered in the dataset registry
   - LYSS metrics configured (LYSS-fst if FST available, LYSS-eq if linter rules exist)
   - Default scoring profile selected (Profile A if FST available, Profile B otherwise)

2. **Baseline benchmark.** We run a 12-model sweep against the development segment to populate the leaderboard with initial scores.

3. **Public announcement.** The language appears on the Network leaderboard with a live development-segment benchmark. The department is credited as the corpus partner.

---

## 3. What the Corpus Must Look Like

### 3.1 Format

Every corpus file is a JSON document following the schema in Benchmark Spec §2.1–§2.2:

```json
{
  "dataset": {
    "id": "crk-ualberta-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "source_language": "en",
    "target_language": "crk",
    "created": "2026-09-15",
    "license": "CC-BY-NC-SA-4.0",
    "provenance": ["textbook", "elicited", "gold_standard"]
  },
  "entries": [
    {
      "id": 1,
      "source": "I see the dog",
      "reference": "niwâpamâw atim",
      "segment": "development",
      "difficulty": 2,
      "provenance": "textbook",
      "register": "conversational",
      "context": "declaration",
      "domain": "edu",
      "morphological_analysis": "ni-wâpam-âw atim | 1sg-see.TA-3sg.DIR dog.AN",
      "notes": "Animate noun (atim); direct form because speaker is proximate"
    }
  ]
}
```

### 3.2 Minimum Size Requirements

| Segment | Minimum Entries | Recommended |
|---------|----------------|-------------|
| `development` | 100 | 200–300 |
| `gold_standard` | 50 | 100–150 |
| `diagnostic` | 10 | 30–50 |
| `held_out` | 10 | 20–30 |
| **Total** | **170** | **350–530** |

### 3.3 Difficulty Distribution

The corpus must include entries across all five difficulty tiers, weighted toward tiers 2–4:

| Tier | Description | Target Distribution |
|------|-------------|-------------------|
| 1 — Basic vocabulary | Single words, common greetings, numbers | 10–15% |
| 2 — Simple sentences | SVO, present tense | 25–30% |
| 3 — Moderate complexity | Past/future tense, possessives, animacy | 30–35% |
| 4 — Complex morphology | Obviation, passive, conjunct order, relative clauses | 15–20% |
| 5 — Advanced | Multi-clause, formal register, ceremonial, idiomatic | 5–10% |

### 3.4 Diagnostic Test Suite

The diagnostic segment tests specific linguistic phenomena using **contrastive pairs**: one correct translation and one minimally-different incorrect translation. If a system's metric scores the correct one higher, the test passes.

For polysynthetic languages, the diagnostic suite should target:

| Phenomenon | Example (Cree) | What It Tests |
|-----------|----------------|--------------|
| **Animacy agreement** | atim (AN) vs. maskisin (IN) — different verb forms | Does the system know which nouns are animate? |
| **Obviation** | Proximate vs. obviative third person | Does it track third-person hierarchy? |
| **Inverse marking** | Direct vs. inverse verb forms | Does it handle patient-outranks-agent? |
| **Conjunct/Independent** | Main clause vs. subordinate clause verb order | Does it use the right verb paradigm? |
| **Inclusive/Exclusive** | "We (including you)" vs. "We (excluding you)" | Does it distinguish first-person plural forms? |

For other language families, identify the 3–5 most diagnostic phenomena that distinguish competent from incompetent translation. The department's linguistic expertise is essential here — these are the tests that only a specialist would know to write.

### 3.5 What We Do NOT Want

| Anti-Pattern | Why |
|-------------|-----|
| **Bible-only text** | Archaic register, liturgical vocabulary, formulaic structure. OMT-1600 evaluated 1,560 languages this way — we deliberately avoid it. |
| **Synthetic evaluation pairs** | LLM-generated references defeat the purpose of evaluation. The reference must be human-authored. |
| **Single-register corpora** | All formal, or all conversational. Real-world translation spans multiple registers. |
| **Difficulty-1-only** | Single words and greetings don't test translation — they test vocabulary lookup. |
| **Machine-translated references** | Using Google Translate output as a "reference" is circular. |
| **Sentences with no context tag** | We need to know the communicative function for diagnostic analysis. |

---

## 4. Cryptographic Sealing and Sandbox Testing {#4-cryptographic-sealing-and-sandbox-testing}

### 4.1 Why Seal the Test Set?

Conventional ML benchmarks publish test sets openly. Once published, frontier LLMs will eventually train on them (intentionally or through web scraping), making scores unreliable. For Indigenous language data, there's an additional concern: published linguistic data can be used without community consent.

Sealing ensures:
- **Test set integrity:** Methods cannot overfit to data they've never seen
- **Data sovereignty:** The community controls who evaluates against their data
- **Perpetual freshness:** The test set never becomes contaminated

### 4.2 How Sandbox Testing Works

```
Developer workflow:
  1. Developer builds a translation method using the PUBLIC development corpus
  2. Developer tests locally against the development segment (unlimited, self-serve)
  3. When ready, developer submits their complete method (code + config + coaching data)
  4. Governance org installs the method in the evaluation sandbox
  5. Sandbox runs the method against the SEALED gold-standard test set
  6. Only scores are returned to the developer
  7. Developer never sees the source sentences or reference translations

The sandbox:
  - Runs on governance-controlled infrastructure
  - Has selective network access (LLM APIs only, no exfiltration)
  - Produces a tamper-proof run card (SHA-256 hash of all inputs and outputs)
  - Logs all execution for audit purposes
  - Can be inspected by the governance org at any time
```

### 4.3 Key Management

The encryption key for the sealed test set is split using Shamir Secret Sharing with a 2-of-3 threshold:

| Share Holder | Role | Revocation Power |
|-------------|------|-----------------|
| **Community governance org** | Primary custodian | Can revoke evaluation access unilaterally |
| **Academic department partner** | Co-custodian | Can participate in key reconstruction |
| **Champollion project** | Escrow | Cannot access data alone; ensures continuity if other parties become unavailable |

Any 2 of 3 shares reconstruct the key. This means:
- The community + department can access the data without Champollion
- The community + Champollion can access the data without the department
- Champollion alone can NEVER access the data

### 4.4 Hash Manifests

When the corpus is sealed, a **hash manifest** is published to a public Git commit:

```json
{
  "corpus_id": "crk-ualberta-v1",
  "seal_date": "2026-09-15T00:00:00Z",
  "segments": {
    "development": {
      "entry_count": 200,
      "sha256": "a3f7c...",
      "access": "public"
    },
    "gold_standard": {
      "entry_count": 100,
      "sha256": "b8d2e...",
      "access": "sealed",
      "key_scheme": "shamir-2-of-3"
    },
    "held_out": {
      "entry_count": 20,
      "sha256": "c9e4f...",
      "access": "sealed",
      "key_scheme": "shamir-2-of-3"
    },
    "diagnostic": {
      "entry_count": 30,
      "sha256": "d1a3b...",
      "access": "public"
    }
  },
  "total_entries": 350,
  "manifest_sha256": "e2b5c..."
}
```

This proves:
- The corpus existed at a specific date
- It has a known size and structure
- Any modification to the sealed segments would break the hash chain
- The community can verify their data hasn't been tampered with

---

## 5. What the Department Gets

### 5.1 Research Infrastructure

| Asset | Description |
|-------|------------|
| **Evaluation harness** | A working, tested evaluation framework for their language — saves months of tool-building |
| **LYSS metrics** | Language-specific evaluation metrics (LYSS-fst, LYSS-eq, LYSS-sem) configured for their language — if FST and dictionary resources exist |
| **Leaderboard** | A public, live leaderboard showing the state of the art for their language pair |
| **Baseline benchmark** | 12-model sweep providing immediate, publishable baselines |
| **Diagnostic test suite** | Targeted tests for specific linguistic phenomena — reusable for other evaluations |

### 5.2 Publications

The corpus construction and evaluation results support multiple publications:

| Paper | Venue | Department Role |
|-------|-------|-----------------|
| Corpus construction methodology | LREC, ComputEL | Lead or co-author |
| Baseline evaluation results | ACL, EMNLP | Co-author |
| LYSS metric validation | WMT Metrics Shared Task | Co-author |
| Diagnostic test suite design | SIGMORPHON, NAACL | Lead or co-author |
| Language-specific NLP resources | Language-specific venues | Lead author |

### 5.3 Grant Positioning

The partnership provides concrete outputs for grant proposals:

- "Open-source evaluation infrastructure for [language] MT" — demonstrable deliverable
- "Cryptographic data sovereignty for Indigenous linguistic data" — applies established Indigenous data-sovereignty frameworks (CARE, Kaitiakitanga, TK Labels) to MT evaluation; publishable
- "Community-governed benchmark with live leaderboard" — ongoing impact metric
- "Independent evaluation of OMT-1600 / Google Translate for [language]" — timely, high-visibility

### 5.4 Community Impact

- The language community gains an **independent evaluation capability** — they can assess whether any MT system (Google, Meta, or custom) actually works for their language
- The community **controls the test data** via cryptographic key custody
- Any methods proven through the benchmark **transfer ownership** to the community (see Benchmark Spec §8.3), which keeps everything a deployment ever earns — Champollion is non-commercial and takes no share

### 5.5 What It Costs the Department

| Component | Estimated Cost | Who Pays |
|-----------|---------------|----------|
| PI/postdoc time (design, oversight) | ~40 hours | Department (or grant-funded) |
| Speaker compensation (translation) | $2,500–6,000 | Grant-funded or Champollion-funded |
| Speaker compensation (review) | $500–1,500 | Grant-funded or Champollion-funded |
| Research coordinator time | ~20 hours | Department |
| **Engineering, infrastructure, harness** | **$0** | **Champollion project** |

We provide all engineering, harness configuration, LYSS metric setup, leaderboard integration, and ongoing infrastructure at no cost to the department. The department's contribution is linguistic expertise and speaker access.

---

## 6. Timeline

| Phase | Duration | Key Milestone |
|-------|----------|--------------|
| 1: Corpus Design | 2–4 weeks | Design document approved |
| 2: Source Sentences + Translation | 4–8 weeks | Raw corpus completed |
| 3: Quality Assurance | 2–4 weeks | Cross-reviewed, schema-validated |
| 4: Sealing | 1 week | Gold-standard sealed, hash manifest published |
| 5: Integration | 1–2 weeks | Language live on leaderboard with baselines |
| **Total** | **10–19 weeks** | **Live leaderboard with sealed evaluation** |

---

## 7. How to Get Started {#7-how-to-get-started}

1. **Contact us** — [project email/contact]. We'll schedule a 30-minute call to discuss your language, available resources, and partnership logistics.

2. **We provide:**
   - This document
   - The corpus schema and validation tools
   - Examples from our existing Cree (CRK) corpus
   - A draft corpus design template

3. **You provide:**
   - A PI or postdoc to lead the linguistic work
   - Access to bilingual speakers (or a plan to recruit them)
   - Information about available resources (FST, dictionary, existing corpora)
   - Institutional approval for data governance (consistent with First Nations data-sovereignty principles, or the community's own framework)

4. **We co-design the corpus** — domain selection, difficulty distribution, diagnostic tests, timeline, and budget.

5. **Work begins.** We check in weekly. The department has full autonomy over linguistic decisions; we handle all engineering.

---

## 8. Frequently Asked Questions

### "We already have a parallel corpus. Can we use it?"

Yes — if the corpus has clear provenance, is human-authored, and the license permits use in evaluation. We'll help you format it to our schema, add missing metadata, and integrate it. Existing corpora can dramatically accelerate the timeline (skip Phase 2 or reduce it to a gap-fill exercise).

### "We don't have an FST for our language."

That's fine. LYSS-fst (morphological validity) requires an FST, but the harness works without it using Profile B weights (chrF++, BLEU, COMET, behavioral metrics). If a GiellaLT FST exists for a related language, we may be able to adapt it. If not, the corpus still enables valuable evaluation — just without the morphological validity gate.

### "Our speakers use a non-Latin script."

Fully supported. The corpus schema handles any Unicode script. We've designed for SRO (Standard Roman Orthography) and syllabics for Cree, but the same infrastructure works for Devanagari, Arabic script, CJK, Ethiopic, or any other writing system.

### "What about dialect variation?"

Tag it. The corpus entry schema includes a `notes` field for dialectal information. If multiple dialects are represented, document them. The linter's equivalence classes (LYSS-eq) can be configured to accept dialectal variants as equivalent. The diagnostic test suite can include dialect-specific contrasts.

### "Who owns the corpus?"

The language community, via the governance organization. The department is credited as a research partner. Champollion holds an escrow key share for operational continuity but cannot access the sealed data alone. The development segment is published under a Creative Commons license specified by the community.

### "What if we want to stop?"

The community can revoke evaluation access at any time by refusing to reconstruct the encryption key. The sealed data is never exposed. The development segment, already published, remains public under its license. The department's research outputs (publications, presentations) are theirs to keep regardless.

### "What if the governance organization doesn't exist yet?"

We can begin with Phases 1–3 (corpus design, creation, QA) without a governance org. The sealing (Phase 4) requires identifying a key custodian. In the interim, the department can serve as the co-custodian alongside the Champollion project, with the understanding that custody transfers to the community governance org when one is established.

---

## Appendix: Tagging vs. Corpus Construction

This document covers **corpus construction** — creating the parallel text pairs that form the evaluation ground truth. Tagging (morphological annotation, interlinear glossing, FST tag strings) is a separate activity that enriches the corpus but is not required for basic evaluation.

| Activity | Required? | What It Enables |
|----------|-----------|-----------------|
| **Corpus construction** (this document) | ✅ Required | Basic evaluation: chrF++, exact match, COMET, behavioral metrics |
| **FST coverage checking** | 🟡 Optional | LYSS-fst morphological validity metric **and** the FST-derived `morphological_accuracy` (lemma-matched — no annotation needed; Scoring Spec §2.2) |
| **Morphological annotation** | 🟡 Optional | Would enable a future *gold-validated* upgrade of `morphological_accuracy`; the FST-derived version (above) needs none |
| **Linter equivalence rules** | 🟡 Optional | LYSS-eq equivalent match metric |
| **Semantic validator rules** | 🟡 Optional | LYSS-sem semantic validation metric |
| **Speaker quality ratings** | Separate activity | Metric validation (see [Speaker Validation Protocol](/docs/network/specifications/speaker-validation)) |

Tagging and speaker validation are covered by separate documents and can proceed in parallel with or after corpus construction.

