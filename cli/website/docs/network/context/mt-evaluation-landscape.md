---
sidebar_position: 3
title: 'Measuring the Immeasurable'
---

# Measuring the Immeasurable: The Evaluation Problem in Machine Translation

**A survey of how the field measures translation quality, where it fails, and what LYSS (Linguistically-informed Yield & Structural Scoring) offers as an alternative**

---

> *"Automatic metrics are a convenient lie. They give us a number, and the number lets us write a paper, and the paper lets us claim progress. Whether progress actually happened is a separate question."*
> — Adapted from a recurring sentiment at WMT Metrics Shared Tasks

---

## Introduction

Machine translation has a measurement problem.

The field has spent two decades building increasingly sophisticated systems — from phrase tables to attention mechanisms to trillion-parameter language models — and throughout that entire arc, it has struggled with a deceptively simple question: *how do you know if a translation is good?*

This question is not academic. The metric you choose determines which system "wins." It determines what gets funded, what gets published, what gets deployed, and — for the languages that need MT most — whether a community's translations are judged as failures when they are, in fact, correct.

The history of MT evaluation is, in miniature, a history of the field's values. The dominance of BLEU for nearly two decades reveals a preference for cheap, fast, language-agnostic measurement over linguistically informed assessment. The rise of neural metrics like COMET reflects the field's growing sophistication — and its continued dependence on English-centric training data. The near-total absence of morphology-aware evaluation reflects a field that has, until recently, been built by and for speakers of analytic European languages.

This paper traces the evolution of MT evaluation from BLEU to the present day, identifies where existing approaches systematically fail for morphologically complex and low-resource languages, and examines what a linguistically-grounded alternative might look like. It is a companion to the project's other context documents — [*From Pāṇini to Transformers*](./history-of-language-and-computation.md) (which traces the intellectual history of language and computation) and the [*Field Briefing*](./mt-field-briefing.md) (which surveys the current MT landscape). Where those documents ask "how did we get here?" and "what exists?", this one asks: "how do we know if any of it works?"

---

## Part 1: The String-Matching Era (2002–2015)

### BLEU and the Birth of Automatic Evaluation



The modern era of MT evaluation begins with a single paper: Kishore Papineni, Salim Roukos, Todd Ward, and Wei-Jing Zhu's "BLEU: a Method for Automatic Evaluation of Machine Translation," published at ACL 2002. BLEU (Bilingual Evaluation Understudy) measures how much a machine translation's word sequences (n-grams) overlap with one or more human reference translations. It includes a brevity penalty to prevent systems from gaming the score with short outputs, and it computes a geometric mean of n-gram precisions at orders 1 through 4.

BLEU became the field's currency for a simple reason: it was fast, cheap, reproducible, and language-independent. Before BLEU, evaluating an MT system required expensive, slow human assessment. BLEU offered a number that could be computed in milliseconds, compared across papers, and used to rank systems in shared tasks. Within a few years, it was essentially mandatory — a paper without BLEU scores was unpublishable.

But BLEU has deep, well-documented flaws that the field has spent two decades trying to work around:

**No semantic understanding.** BLEU is pure surface matching. "The cat sat on the mat" scores zero against a reference of "the feline rested on the rug." Every word is a correct synonym; the meaning is identical; the score is zero.

**Morphological blindness.** For agglutinative and polysynthetic languages, strict word-level matching fails catastrophically. A correctly conjugated Cree verb that differs by one morpheme from the reference scores zero — even if the difference is a grammatically optional particle or an equally valid word order.

**Poor sentence-level discrimination.** BLEU was designed as a corpus-level metric. At the sentence level, it is noisy and unreliable — yet it is routinely applied to individual sentences.

**Single-reference bias.** BLEU assumes there is *one* correct translation (or a small set of references). For languages with free word order, synonym-rich vocabularies, or systematic ambiguities (like Cree's inclusive/exclusive "we"), there may be dozens of equally correct translations, and BLEU penalises all but the one that happens to match the reference.

**Weak correlation with human judgment.** Meta-analyses — notably Reiter (2018, *Computational Linguistics*) — have shown that BLEU's correlation with human quality assessments is often weak, particularly for high-quality systems and for languages distant from English.

These flaws were known almost from the beginning. Yet BLEU persisted because the alternatives were worse — not in accuracy, but in convenience. The field optimised for the metric it could compute, not the metric it needed.

### NIST (Doddington, 2002)

The NIST metric, published in the same year as BLEU by George Doddington at HLT 2002, modified the BLEU formula in two ways. First, it weighted n-grams by their **information content** — rare n-grams received higher weight than common ones, on the intuition that correctly translating an unusual phrase is more informative than correctly translating "of the." Second, it used an **arithmetic mean** instead of BLEU's geometric mean, producing more stable scores that didn't collapse to zero when any single n-gram order had no matches. NIST was used extensively in the DARPA TIDES and NIST OpenMT evaluation programmes but never achieved BLEU's dominance in the broader research community. Despite its improvements, it shared BLEU's fundamental limitation: surface-level string matching with no concept of meaning.

### METEOR (Banerjee & Lavie, 2005)

METEOR (Metric for Evaluation of Translation with Explicit ORdering) was an early attempt to address BLEU's rigidity. Where BLEU performs exact word matching, METEOR introduced three innovations:

1. **Stemming**: Words are reduced to their stems before comparison, giving partial credit for morphological variants (e.g., "running" matches "ran" after stemming).
2. **Synonym matching**: Using WordNet, METEOR recognises that "car" and "automobile" are the same concept.
3. **Word alignment**: Rather than counting n-gram overlaps, METEOR explicitly aligns words between the hypothesis and reference, then computes precision and recall with a fragmentation penalty.

METEOR consistently showed higher correlation with human judgments than BLEU. But it required language-specific resources (stemmers, synonym databases) that limited its applicability, and it was slower to compute. For English, it was better. For low-resource languages, the stemmers and synonym databases simply didn't exist.

### TER (Snover et al., 2006)

Translation Edit Rate measures the minimum number of edits (insertions, deletions, substitutions, and *phrase shifts*) needed to transform the hypothesis into the reference, normalised by reference length. The phrase-shift operation — moving a contiguous sequence of words to a different position — was a direct acknowledgment that word order is not fixed across languages. TER's edit-distance approach is intuitive (it measures "how much work would a human post-editor need to do?") but inherits the same fundamental limitation: it compares against a single reference and has no concept of meaning.

### chrF and chrF++ (Popović, 2015; 2017)

The most important metric innovation between BLEU and the neural era came from Maja Popović. **chrF** (character F-score) measures overlap at the *character* level rather than the word level, computing character n-gram precision and recall. **chrF++** adds word-level unigrams and bigrams back into the mix.

Why this matters for morphologically rich languages: character-level matching gives *partial credit* for shared morphemes. The Cree words *nikî-nipâw* ("I slept") and *kikî-nipâw* ("you slept") share most of their character n-grams despite being different words. chrF would give substantial partial credit; BLEU would give zero.

chrF++ has become a standard secondary metric at WMT shared tasks, implemented in **sacreBLEU** (Post, 2018), and is widely acknowledged as superior to BLEU for morphologically rich languages. But it remains a string-matching metric — better than BLEU, but fundamentally limited by the same assumption that translation quality can be measured by surface-form overlap.

---

## Part 2: The Neural Metric Revolution (2018–Present)



### The Insight: Learn to Score

The string-matching metrics of Part 1 share a fundamental design choice: they are hand-crafted formulas. Someone decided that n-gram precision, character overlap, or edit distance was a good proxy for translation quality, and then everyone used that formula for a decade.

The neural metric revolution began with a different question: *what if we trained a model to predict translation quality, the same way we train models to translate?*

### BERTScore (Zhang et al., 2020)

BERTScore, published at ICLR 2020 by Tianyi Zhang and colleagues at Cornell and MIT, was the first widely-adopted metric to move evaluation from exact string matching to semantic similarity. The mechanism is elegant: encode both the hypothesis and reference through a pre-trained Transformer model (BERT, RoBERTa, or DeBERTa), compute the cosine similarity between every pair of token embeddings, and then use greedy matching to compute precision (each hypothesis token's best match in the reference), recall (each reference token's best match in the hypothesis), and F1.

BERTScore handles synonyms, paraphrases, and word-order variations naturally — "the feline rested on the rug" gets high similarity to "the cat sat on the mat" because the contextual embeddings capture semantic equivalence. With multilingual BERT, it extends to any language the model covers.

But BERTScore is not *trained* on human quality judgments. It uses pre-trained embeddings as-is, which means it captures general semantic similarity rather than specifically learning what makes a *translation* good. This distinction matters: a sentence can be semantically similar to a reference while being a poor translation (wrong register, omitted negation, hallucinated qualifier). BERTScore also inherits whatever language biases exist in the underlying model — for languages underrepresented in BERT's training data, the embeddings may not capture meaningful distinctions.

### BLEURT (Sellam et al., 2020)

BLEURT (Bilingual Evaluation Understudy with Representations from Transformers), published at ACL 2020 by Thibault Sellam, Dipanjan Das, and Ankur Parikh at Google, introduced a key innovation: **pre-training on synthetic perturbations** before fine-tuning on human judgments. The insight was that fine-tuning a language model directly on the small WMT human judgment datasets produced a metric that was brittle — it overfit to the specific patterns in the training data and failed on out-of-distribution inputs.

BLEURT's solution was a two-phase training recipe. In phase one, millions of synthetic sentence pairs were generated through random word drops, insertions, substitutions, and backtranslation. The model was trained to predict existing automatic metric scores (BLEU, ROUGE, BERTScore, entailment) for these pairs — learning general notions of textual similarity. In phase two, the pre-trained model was fine-tuned on WMT Direct Assessment ratings. This "warming up" dramatically improved robustness.

BLEURT-20 extended the approach to multilingual evaluation using Google's RemBERT encoder. But BLEURT remains reference-only — it doesn't use the source text, which means it cannot detect hallucinations that happen to be fluent, and it depends entirely on the reference's quality.

### COMET (Rei et al., 2020)

COMET (Crosslingual Optimized Metric for Evaluation of Translation) represents the current state of the art in automatic MT evaluation. Developed by Ricardo Rei and colleagues at **Unbabel**, COMET uses a cross-lingual encoder (XLM-RoBERTa) to embed three inputs — the source sentence, the MT hypothesis, and the reference translation — and predicts a quality score trained on human Direct Assessment judgments.

COMET won or placed first in WMT Metrics Shared Tasks from 2020 onward. Its correlation with human judgment is substantially higher than any string-matching metric. It recognises paraphrases, captures meaning preservation, and handles synonym variation that BLEU misses entirely.

But COMET has a critical limitation for our purposes: it is trained on human judgments from WMT, which are overwhelmingly in European languages. Its cross-lingual encoder (XLM-R) was trained on CommonCrawl data where Plains Cree, North Sámi, and most indigenous languages are essentially absent. For these languages, COMET's internal representations are unreliable — it may produce scores, but those scores are not grounded in any real understanding of the language's structure.

### xCOMET (Guerreiro et al., 2024)

xCOMET, published in TACL 2024 by Nuno Guerreiro, Ricardo Rei, and colleagues at Unbabel and Instituto Superior Técnico, extended COMET from a black-box scorer to a **diagnostic tool**. The key innovation is multi-task learning: alongside the sentence-level quality score, xCOMET performs **subword-level sequence tagging** to identify specific error spans in the translation and classify them as minor, major, or critical.

This bridges the gap between automatic scoring and MQM-style human error analysis. Instead of just reporting "this translation scores 0.73," xCOMET can point to the specific words that are wrong and indicate how severely. The training uses a curriculum learning approach: first train on Direct Assessment data for sentence-level regression, then add MQM-annotated data with error span labels for joint training.

xCOMET achieved state-of-the-art performance at sentence-level, system-level, and span-level evaluation simultaneously. It works in both reference-based and reference-free modes. But it requires MQM-annotated training data — which is expensive to create and exists overwhelmingly for European language pairs.

### AfriCOMET (Wang & Adelani, NAACL 2024)

AfriCOMET, published at NAACL 2024 by Jiayi Wang, David Ifeoluwa Adelani, and colleagues in the Masakhane community, is the most important proof that neural metrics *must* be adapted for underserved languages — they do not generalise out of the box.

The paper first demonstrated the problem: standard COMET, trained on WMT data from European languages, showed significantly weaker correlation with human judgments when applied to 13 African languages (including Amharic, Hausa, Igbo, Swahili, Yoruba, and Zulu). The fix required two changes. First, replacing XLM-R with **AfroXLM-R**, a cross-lingual encoder specifically trained to better represent African languages. Second, creating **AfriMTE**, a new human evaluation dataset with simplified MQM guidelines designed for non-expert annotators — because finding bilingual professional translators for these languages is difficult.

AfriCOMET proved the concept: a language-family-specific neural metric can dramatically outperform the generic version. But it also proved the cost: someone had to build AfroXLM-R, collect human judgment data for 13 languages, and train a new model. For Plains Cree, no equivalent encoder, human judgment dataset, or adapted metric exists. The AfriCOMET path would require creating all of these from scratch — a multi-year effort involving community-based human evaluation and probably a dedicated Algonquian-family encoder.

### GEMBA: LLM-as-Evaluator (Kocmi & Federmann, 2023)

GEMBA (GPT Estimation Metric Based Assessment), published at EAMT 2023 by Tom Kocmi and Christian Federmann at Microsoft, asked a radical question: what if you just *asked* GPT-4 whether a translation was good?

The approach is disarmingly simple. **GEMBA-DA** prompts the LLM with the source and hypothesis and asks for a quality rating on a 0–100 scale. **GEMBA-MQM** provides three annotated examples and asks the LLM to identify specific error spans, classify them by type and severity, and produce an MQM-style score. No metric-specific training is required.

The results were striking: at the system level, GEMBA achieved competitive or state-of-the-art correlation with human judgments. GEMBA-MQM's error annotations, while not as reliable as human annotators, provided interpretable diagnostic information without any specialised training.

But GEMBA raises serious concerns. It depends on proprietary closed-source models whose behaviour changes between API versions. Results are not reproducible in the strict sense. It is expensive at scale (API costs for evaluating a full WMT test set). And — critically for our purposes — the LLM's knowledge of low-resource languages is uncertain. GPT-4 may or may not understand Plains Cree morphology well enough to evaluate translations; there is no way to know without testing, and no guarantee the behaviour will be consistent across model updates. Kocmi and Federmann themselves advised against using GEMBA to claim improvements in academic papers due to the black-box nature of the evaluation.

### MetricX and the WMT 2024 Metrics Shared Task

**MetricX-24**, developed by Juraj Juraska, Daniel Deutsch, Mara Finkelstein, and Markus Freitag at Google, won the WMT 2024 Metrics Shared Task. Built on **mT5** (Multilingual T5, an encoder-decoder model rather than the encoder-only XLM-R used by COMET), MetricX takes a different architectural path. It uses two-stage fine-tuning — first on Direct Assessment data, then on MQM scores — with extensive **synthetic data augmentation** targeting known metric failure modes (undertranslation, fluent-but-wrong translations, hallucinations).

The WMT 2024 findings paper, titled **"Are LLMs Breaking MT Metrics?"**, asked whether LLM-generated translations had broken the metric ecosystem. The answer was a qualified no: fine-tuned neural metrics (MetricX-24, COMET variants) remained effective, though LLM-based metrics (GEMBA variants) showed surprising strength at the system level. Key findings:

- **Source-aware metrics** (using source + reference + hypothesis) consistently outperformed reference-only metrics
- **Hybrid models** that operate in both reference-based and reference-free modes from a single architecture are the emerging direction
- The **low-resource gap** persists: all metrics perform worse on underrepresented languages, and the gap is not narrowing
- **MQM-trained metrics** (using fine-grained error annotations) consistently outperform DA-trained metrics (using scalar scores)

The implications for low-resource evaluation are clear: the field is converging on large, trained, source-aware neural metrics as the gold standard. These metrics require substantial training data, compute, and — critically — human evaluation data in the target language. For languages without any of these resources, the state-of-the-art metric pipeline simply does not apply.

### The Bias Problem: Neural Metrics and Low-Resource Languages

The neural metric revolution has been, overwhelmingly, a high-resource phenomenon. Every trained metric in the preceding sections was trained on WMT human judgment data, which covers approximately 20 language pairs — all of them involving European languages, Chinese, or Japanese. The underlying encoders (XLM-R, mT5, InfoXLM) were trained on CommonCrawl data where representation is proportional to web presence: English dominates, European languages are well-covered, and the vast majority of the world's 7,000+ languages are effectively absent.

For a language like Plains Cree, this creates a cascading failure:

1. **No training data**: There are no WMT human judgments for Cree translations, so no metric has been trained to evaluate them.
2. **No encoder coverage**: XLM-R's vocabulary was built on CommonCrawl, where Cree text is vanishingly rare. The tokeniser over-segments Cree words into arbitrary byte fragments, and the contextual embeddings for those fragments are poorly trained.
3. **No validation**: Nobody has measured whether COMET, BLEURT, or MetricX produces meaningful scores for Cree. They may produce *numbers*, but there is no evidence those numbers correlate with actual translation quality.
4. **No path to improvement**: The AfriCOMET approach — build a language-family-specific encoder, collect human evaluation data, train a new metric — is a multi-year, multi-institution effort. For a language community of 20,000 speakers, the research infrastructure to support this does not currently exist.

The result is a paradox: the languages that need MT evaluation most urgently (because their MT systems are weakest and need the most careful assessment) are precisely the languages where the best evaluation tools are least reliable. The field's response has been to recommend chrF++ as a "good enough" alternative — and it is better than BLEU — but chrF++ is still a string-matching metric that cannot detect equivalence, cannot handle free word order, and has no concept of morphological validity.

---

## Part 3: Beyond Scoring — Diagnostic and Linguistic Evaluation

### The Adequacy/Fluency Split

Before automatic metrics existed, human evaluation of MT used a framework with two dimensions: **adequacy** (does the translation convey the meaning of the source?) and **fluency** (is the translation grammatical and natural in the target language?). This distinction, codified in early DARPA MT evaluations and later at NIST, acknowledged something that automatic metrics would spend two decades trying to recapture: translation quality is not one-dimensional.

The adequacy/fluency framework fell out of favor when Direct Assessment (a single scalar score) replaced it at WMT. But the underlying insight remains critical: a translation can be fluent but wrong (hallucination), or disfluent but correct (morphological variant). No single score captures both.

### MQM: The Gold Standard (Lommel et al., 2014; Freitag et al., 2021)

**Multidimensional Quality Metrics (MQM)** replaced Direct Assessment as WMT's primary human evaluation from 2021 onward. MQM uses professional translators who mark specific error spans, classify them by type (mistranslation, omission, addition, grammar, terminology) and severity (minor = 1 point, major = 5 points, critical = 25 points). This produces both a quality score and actionable diagnostic information.

MQM is the closest thing to a "correct" evaluation methodology — it tells you not just *how bad* a translation is, but *what specifically went wrong*. But it requires bilingual professional translators, which for most low-resource languages do not exist in sufficient numbers for statistically reliable evaluation.

### MorphEval: Contrastive Morphological Evaluation (Burlot & Yvon, 2017)

MorphEval is the most direct prior art for morphology-aware MT evaluation. Introduced by Franck Burlot and François Yvon at WMT 2017 and extended in 2018, MorphEval evaluates morphological *competence* using **contrastive test suites**.

**How it works:** The test suite consists of sentence pairs in the source language that differ by exactly one morphological contrast — for example, singular vs. plural, present vs. past, masculine vs. feminine. The MT system translates both sentences. If the system correctly conveys the contrast in its translations (e.g., producing a plural target when the source is plural and a singular target when the source is singular), the contrast is scored as correct.

**Languages covered:** English→Czech, English→Latvian (v1, WMT 2017); extended to English→French, English→German, English→Finnish, Turkish→English (v2, WMT 2018).

**Key findings:** MorphEval revealed that even top-performing neural MT systems had systematic morphological failures — they could produce fluent output while getting tense, number, or case wrong. These errors were invisible to BLEU and even partially invisible to COMET.

**Availability:** Open source on GitHub ([franckbrl/morpheval](https://github.com/franckbrl/morpheval), [franckbrl/morpheval_v2](https://github.com/franckbrl/morpheval_v2)).

**Limitations:** MorphEval requires crafted contrastive test suites per target language, designed by linguists who understand the morphological contrasts of that language. No test suites exist for any polysynthetic language. The methodology tests for *competence* (can the system handle this contrast?) rather than *validity* (did the system produce real words?) or *equivalence* (are these two different translations both correct?).

### CheckList: Behavioral Testing for NLP (Ribeiro et al., ACL 2020)

**CheckList**, published at ACL 2020 by Marco Tulio Ribeiro and colleagues (winning Best Paper), imported an idea from software engineering into NLP evaluation: **unit testing**. Rather than evaluating a model's aggregate performance on a benchmark, CheckList defines a matrix of **capabilities** (vocabulary, negation, named entities, temporal reasoning, coreference) crossed with **test types**:

- **Minimum Functionality Tests (MFT)**: Simple, targeted test cases that any competent model should pass.
- **Invariance Tests (INV)**: Perturbations to the input that should *not* change the output (e.g., changing a name shouldn't change sentiment).
- **Directional Expectation Tests (DIR)**: Perturbations that *should* change the output in a predictable direction.

Checklist was originally designed for sentiment analysis and NLI, but the paradigm is directly applicable to MT. One could create MFTs for morphological phenomena ("does the system produce the correct plural form?"), INV tests for free word order ("does reordering the Cree words change the English translation?"), and DIR tests for morphological features ("does changing the source from past to present tense change the target tense?").

The CheckList paradigm is particularly relevant because it formalises what MorphEval does intuitively: test specific capabilities rather than measuring aggregate scores. Our linter's variant classes (WORD_ORDER, ORTHOGRAPHIC, OPTIONAL_PARTICLE, etc.) are, in effect, invariance rules — they define perturbations that should not change the evaluation verdict.

### Challenge Sets and Targeted Evaluation

The broader paradigm of **challenge sets** — crafted test suites targeting specific linguistic phenomena — has become an established complementary evaluation methodology at WMT since approximately 2017.

**Isabelle, Cherry & Foster (2017)**, at NRC Canada, pioneered the approach for MT with hand-crafted test sets isolating structural divergences between languages — cases where literal translation is likely incorrect. Their follow-up work (Isabelle & Kuhn, 2018) constructed 506 French sentences targeting specific translation challenges, providing fine-grained pictures of system capabilities.

**LingEval97** (Sennrich, EACL 2017) created 97,000 contrastive English→German translation pairs testing whether NMT models assign higher probability to correct translations versus pairs with introduced morphosyntactic errors. A key finding: character-level models excelled at transliteration but performed worse at long-distance morphosyntactic agreement.

**ACES** (Amrhein, Moghe & Guillou, 2022–2023) scaled the challenge set approach dramatically: 36,476 examples spanning 146 language pairs testing 68 distinct linguistic phenomena. ACES was used to meta-evaluate metrics submitted to the WMT metrics shared task — testing whether *metrics* could detect the contrasts, not just whether *systems* could produce them. Extended to **SPAN-ACES** with error span annotations.

**MT-GenEval** (Currey et al., EMNLP 2022) and **WinoMT** (Stanovsky, Smith & Zettlemoyer, ACL 2019) target gender accuracy specifically. WinoMT is notable because it explicitly uses **morphological analysis** on the target language to verify the gender of translated occupations — one of the few cases where a morphological analyser is used as part of an MT evaluation tool.

**Hjerson** (Popović & Ney, 2011) is an open-source tool for automatic MT error classification that uses **lemmas and POS tags** to categorise errors into five types: morphological, reordering, missing words, extra words, and lexical errors. This is perhaps the closest prior art to our linter in spirit — it uses linguistic analysis to provide diagnostic error categories rather than a single score.

The common thread: the field has acknowledged, repeatedly, that aggregate scores are insufficient. Diagnostic evaluation provides the granularity needed to understand *why* a system fails. But diagnostic approaches require linguistic expertise per language, and that expertise is concentrated in European languages.

### AmericasNLP: Evaluation in the Trenches

The AmericasNLP workshop series (co-located with NAACL), focused on NLP for Indigenous languages of the Americas, provides the most direct comparison point for our evaluation challenges.

From 2021 through 2023, the shared task used **chrF** as its primary evaluation metric — chosen for its robustness in low-resource settings and its character-level matching, which provides partial credit for morphological overlap. The organisers acknowledged chrF's limitations but had no better alternative that could work across the diverse typologies represented (Quechua, Guaraní, Aymara, Nahuatl, Rarámuri, and others).

In 2025, AmericasNLP introduced a dedicated **Shared Task 3** specifically for developing MT evaluation metrics for Indigenous languages — the first time the field explicitly acknowledged that existing metrics are inadequate for these languages. The winning submission, **FUSE** (Feature-Union Scorer), combined multilingual sentence embeddings (fine-tuned LaBSE), lexical similarity, phonetic similarity, and fuzzy token matching via Ridge regression and Gradient Boosting. FUSE does not use morphological analysers — the feature engineering is language-agnostic.

This is the gap our work occupies. AmericasNLP has identified the problem (standard metrics fail for Indigenous languages) and begun developing alternatives (FUSE). But none of the alternatives use the morphological knowledge that FSTs provide. The AmericasNLP community uses chrF++ because it is the best available generic option, while the GiellaLT community builds sophisticated morphological tools that never get plugged into MT evaluation. The two communities have not converged.

---

## Part 4: Reference-Free Evaluation and Quality Estimation

Some of the most important evaluation signals in our harness do not require reference translations at all. The FST validity check ("is this a real word?") needs only the MT output. The hallucination detector needs the source and hypothesis. The code-switching detector needs only the hypothesis and knowledge of the target language's script. Understanding where these fit in the broader landscape of reference-free evaluation is essential for positioning them correctly.

### The Quality Estimation Paradigm

**Quality Estimation (QE)** is the subfield of MT evaluation concerned with predicting translation quality *without* reference translations. It has been a dedicated shared task at WMT since 2012, motivated by the practical need to assess MT quality at deployment time — when you are translating new text and have no human reference to compare against.

The QE task has evolved through three generations. **Feature-based QE** (2012–2016) extracted hand-crafted features from the source and hypothesis — language model perplexity, word frequency, n-gram overlap with monolingual data — and trained classifiers to predict quality. **Neural QE** (2017–2021) replaced hand-crafted features with learned representations, typically using bilingual encoders. **Current QE** (2022–present) is dominated by COMET-based approaches, particularly **CometKiwi**.

### CometKiwi and Reference-Free COMET

**CometKiwi** (Rei et al., WMT 2022), the reference-free variant of COMET, uses InfoXLM to encode the source sentence and MT hypothesis (without a reference) and predicts a quality score. It achieved state-of-the-art results in the WMT 2022 and 2023 QE shared tasks.

The remarkable finding: reference-free CometKiwi approaches the correlation with human judgment achieved by reference-based COMET. This suggests that, for well-resourced languages, the source text contains nearly as much evaluation signal as the reference translation. But the same caveat applies: CometKiwi's encoder has minimal representation for low-resource languages, so its reference-free predictions for Cree or Sámi are unreliable.

This is where our FST-based metrics offer something genuinely different. The FST validity check is a **deterministic, reference-free quality signal** that requires no trained model and no human judgment data. If the FST says a word is not a valid Cree word, that word is not a valid Cree word — with the caveat of false rejections for loanwords, neologisms, and proper nouns. This kind of hard, rule-based quality signal has no equivalent in the neural QE ecosystem.

### Hallucination Detection in MT

Hallucination in MT — fluent output that is completely unrelated to the source — is a serious failure mode, particularly in low-resource settings where models have insufficient training data to learn reliable source-target correspondences.

The academic state of the art in hallucination detection uses several approaches:

- **Embedding-based detection**: Comparing source and hypothesis embeddings in a shared space (LASER, LaBSE) and flagging cases where similarity is below a threshold.
- **Probability-based detection**: Using the MT model's own confidence scores — hallucinations tend to have high output probability but low source-conditioned probability.
- **Contrastive perturbation**: Comparing the MT output for the real source against output for a perturbed or unrelated source; if the outputs are suspiciously similar, the model is ignoring the source.
- **LLM-as-judge**: Prompting an LLM to assess whether the translation is faithful to the source.

Our harness uses a **heuristic detection plugin** that combines four signals: length inflation (hypothesis much longer than expected), repetition (repeated phrases), entity mismatch (named entities in the source missing from the hypothesis), and source echo (hypothesis is too similar to the source text, suggesting untranslated copying). This is baseline-level compared to academic SOTA — it catches gross hallucinations but will miss subtle ones. Its value is as a **cheap, fast, reference-free screen** that can flag the worst failures without requiring a GPU or an API call.

### Code-Switching Detection

Code-switching in MT output — where the system produces words in the source language rather than translating them — is a distinct failure mode from hallucination. It typically occurs when the model encounters a word it cannot translate and falls back to copying the source.

Our code-switching detection plugin uses **Unicode block analysis** (detecting characters from the source language's script in what should be target-language output) and **common-word lists** (identifying high-frequency source-language words that appear untranslated). For Cree, which uses both SRO (Latin-based) and syllabics, this requires some care — English and SRO share the Latin script, so Unicode block analysis alone is insufficient.

The academic literature on code-switching detection in MT is sparse compared to hallucination detection. Most work focuses on code-switching in *input* text (bilingual speakers mixing languages) rather than in *output* text (MT systems failing to translate). Our heuristic approach is, to our knowledge, not significantly behind any published state of the art for this specific problem.

---

## Part 5: The Morphological Gap

### What Existing Metrics Cannot See

This is the core argument of this paper, and it requires a concrete demonstration.

Consider the Plains Cree sentence pair:

| | Text |
|--|------|
| **Source (English)** | "I saw the man" |
| **Reference (Cree)** | *nikî-wâpamâw nâpêw* |
| **Hypothesis A** | *nâpêw nikî-wâpamâw* |
| **Hypothesis B** | *nikî-wâpamikow nâpêsis* |

**Hypothesis A** is a perfect translation — it has the same words in a different order, which is grammatical in Cree (free word order). **Hypothesis B** says "the boy was seen by me" — wrong direction of action (*-ikow* is inverse), wrong referent (*nâpêsis* = "boy", not "man").

| Metric | Hypothesis A (correct) | Hypothesis B (wrong) | Can it tell them apart? |
|--------|----------------------|---------------------|------------------------|
| BLEU | ~30% | ~20% | Barely |
| chrF++ | ~65% | ~55% | Somewhat |
| COMET | Unknown (no Cree training data) | Unknown | Unreliable |
| **FST acceptance** | 100% | 100% | No (both are valid Cree) |
| **Linter** | EQUIVALENT (WORD_ORDER) | MISS | **Yes** |
| **Semantic validator** | VALID | WRONG | **Yes** |

The linter and semantic validator succeed where BLEU, chrF++, and COMET fail — not because they are "better metrics" in some universal sense, but because they have access to *linguistic knowledge* that string-matching and neural metrics do not. They know that Cree has free word order. They know that *wâpamêw* and *wâpamikow* are different lemmas with different argument structures. They know that *nâpêw* and *nâpêsis* are different words.

This knowledge comes from the FST (which encodes the morphological grammar), the bilingual dictionary (which provides English glosses for each lemma), and the manually-defined variant classes (which encode linguistically-grounded equivalence rules). None of this knowledge is available to a metric that treats the translation as a string.

### Why the Field Has Not Addressed This

The morphological gap in MT evaluation is not a mystery. The field knows it exists. The reasons it persists are structural:

1. **Scale bias.** The MT evaluation community optimises for metrics that work across all WMT language pairs. FST-based metrics work for ~30 languages. COMET works for 100+. chrF++ works for all languages with a writing system. The community rewards universality over precision.

2. **Community silos.** The people who build FSTs (computational linguists at UiT Tromsø, NRC Canada, University of Alberta) and the people who build evaluation metrics (ML researchers at Google, Unbabel, WMT) attend different conferences, publish in different venues, and operate under different incentive structures. The cross-pollination that would be required to build FST-based evaluation metrics has not happened — not because it was tried and failed, but because the communities never converged.

3. **Coverage anxiety.** FSTs have known false-rejection problems: loanwords, neologisms, and proper nouns may be rejected as invalid even when they are perfectly acceptable. This makes researchers nervous about using FSTs as metrics — a false rejection inflates the error rate. The concern is valid but quantifiable: measuring the false rejection rate on known-good text is straightforward.

4. **Insufficient demand.** Very few people are building MT for polysynthetic languages, and the ones who are (ALT Lab, NRC, AmericasNLP participants) are typically using chrF++ because that is what exists. There has been no concerted push from the low-resource MT community for morphology-aware evaluation, partly because the community is small and partly because building such metrics requires expertise in both NLP engineering and the specific target language's morphology.

5. **The neural metric assumption.** The prevailing assumption since 2020 has been that neural metrics will eventually solve the morphological problem through learned representations. If you train COMET on enough data from morphologically rich languages, the argument goes, it will learn to handle morphological variation implicitly. This may be true for high-resource morphologically rich languages (Finnish, Turkish, Czech). It is unlikely to be true for languages with effectively zero representation in the training data.

---

## Part 6: LYSS — A Linguistically-Grounded Alternative

### What champollion Built: LYSS (Linguistically-informed Yield & Structural Scoring)

The champollion project's evaluation harness implements a composite scoring framework called **LYSS** that combines standard metrics (chrF++, exact match) with four categories of linguistically-informed metrics. The name reflects the framework's focus: measuring the *yield* (how much meaning survives the translation process) through *structural scoring* (deterministic, linguistically-grounded checks rather than learned embeddings).

#### 1. Morphological Validity Gate (GiellaLT FST Metric)

The simplest and most broadly applicable metric: feed every word of the MT output through the GiellaLT finite-state morphological analyser for the target language. If the FST can parse a word (returns at least one analysis), the word is morphologically valid. If not, the word does not exist in the target language — it is either a hallucinated word, a morphological error, a misspelling, or a loanword not in the lexicon.

**Output:** `fst_validity_rate` (0.0–1.0, higher = better). Macro-average (mean of per-entry rates) and micro-average (total valid words / total words).

**Dependencies:** `pyhfst` (Helsinki Finite-State Technology Python bindings), a compiled `.hfstol` analyser file for the target language.

**Extensibility:** Works for any language with a GiellaLT FST analyser — currently ~30+ languages, primarily Sámi, Uralic, and indigenous Arctic languages.

**Relation to prior art:** MorphEval tests whether a system can handle specific contrasts. The FST metric tests whether the system's output consists of real words. These are complementary: MorphEval tests competence, the FST metric tests validity.

#### 2. Linguistic Equivalence Classes (CRK Linter)

The linter addresses what may be the most insidious failure mode of reference-based evaluation: **penalising correct translations that differ from the reference**.

The Plains Cree linter (844 lines) implements six **variant classes**, each encoding a linguistically-grounded equivalence rule:

- **WORD_ORDER**: Cree has pragmatically free word order (Wolfart, 1973 §3.2). *nikî-wâpamâw nâpêw* and *nâpêw nikî-wâpamâw* mean the same thing. The linter generates all permutations and checks if the hypothesis matches any.
- **ORTHOGRAPHIC**: The Standard Roman Orthography has known variation points — circumflex vs. macron (*â* vs. *ā*), hyphenation of preverbs (*nikî-nipâw* vs. *nikî nipâw* vs. *nikînipâw*). The linter normalises these.
- **OPTIONAL_PARTICLE**: Certain discourse particles (*mâka*, *êkwa*, *êwako*) can be present or absent without changing the core proposition. The linter checks if the hypothesis matches the reference after particle removal.
- **LEMMA_SYNONYM**: Some Cree lemmas are interchangeable in specific contexts. This uses a curated synonym list (e.g., dialectal variants) and, when the FST is available, checks whether the hypothesis and reference share morphological analyses.
- **PROGRESSIVE_AMBIGUITY**: English progressive forms ("is walking") can be translated into Cree using different constructions. The linter recognises these as equivalent.
- **INCLUSIVE_EXCLUSIVE**: Cree distinguishes inclusive "we" (*ki-* prefix) from exclusive "we" (*ni-* prefix) — a distinction that English collapses into a single pronoun. The linter recognises that either form may be correct when the English source is ambiguous.

The linter produces three verdicts: **EXACT** (hypothesis matches reference), **EQUIVALENT** (hypothesis differs but is classified as a valid variant), or **MISS** (no match found). At the aggregate level, it computes an `equivalent_match_rate` — the proportion of translations that are exact or equivalent.

**Relation to prior art:** The closest parallel is **HyTER** (Dreyer & Marcu, NAACL-HLT 2012), which encodes exponentially many valid translations as paraphrase networks and measures edit distance to the nearest valid form. Our linter is conceptually similar — it defines a set of valid translations for each reference — but uses linguistically-defined transformation rules rather than paraphrase databases. HyTER was designed for English; no one has built paraphrase networks for Cree. Our variant classes are, in effect, a compact, rule-based approximation of what HyTER does with graphs.

In the CheckList framework, our variant classes function as **invariance tests**: transformations that should not change the evaluation verdict. The difference is that CheckList tests are typically applied to the *model*; our variant rules are applied to the *metric*.

#### 3. Deterministic Semantic Validation (CRK Semantic Metric)

The semantic validator (792 lines) attempts something more ambitious: **deterministic meaning comparison** without neural embeddings. It operates in four stages:

1. **Morphological analysis**: Both the hypothesis and reference are passed through the CRK FST analyser, which returns the lemma and morphological features for each word.
2. **Gloss resolution**: Each lemma is looked up via the itwêwina dictionary API — which serves Wolvengrey (2001) alongside the Maskwacîs and Alberta Elders' dictionaries — to obtain English glosses.
3. **Content-word extraction**: Using spaCy's English pipeline (`en_core_web_md`), function words are filtered from both the English glosses and the source text.
4. **Overlap scoring**: The content-word overlap between the hypothesis's glosses and the reference's glosses determines the semantic verdict.

The validator produces categorical verdicts: **EXACT_MATCH**, **VALID** (different words but same meaning), **GRAMMAR_ISSUES** (correct lemmas but sentence-level grammar problems — agreement, animacy, verb form), **PARTIAL** (some meaning preserved), **INCOMPLETE** (meaning partially missing), **WRONG** (different meaning), or **NO_OUTPUT**.

**Relation to prior art:** This is, in effect, a **deterministic approximation of COMET's semantic similarity computation**. Where COMET uses learned cross-lingual embeddings to assess whether two sentences mean the same thing, our validator uses a chain of deterministic lookups: FST → dictionary → spaCy. The advantage is transparency (every step is inspectable and deterministic) and independence from training data. The disadvantage is brittleness: the quality of the assessment depends entirely on the FST's coverage and the dictionary's completeness.

The approach is conceptually related to **MEANT** (Lo & Wu, 2011; Lo, 2017), which used semantic role labelling to assess whether the "who did what to whom" structure was preserved in translation. Our approach is more coarse-grained (content-word overlap rather than semantic roles) but operates on a language where no SRL tools exist.

#### 4. Behavioral Detection Plugins (Hallucination, Code-Switching, Terminology)

Three additional plugins provide **behavioral quality signals** that complement the morphological metrics:

- **Hallucination detection** (259 lines): Four heuristic signals weighted and combined — length inflation (40%), repetition (30%), entity mismatch (20%), source echo (10%). These are cheap, reference-free screens that catch gross fabrication.
- **Code-switching detection** (~280 lines): Unicode block analysis plus common-word lists to detect untranslated source-language tokens. Outputs a `code_switching_rate` (0.0–1.0).
- **Terminology adherence** (199 lines): Checks whether specified glossary terms are translated consistently. Returns `terminology_adherence` (0.0–1.0) or None if no glossary is configured.

These plugins are honestly positioned as **baseline heuristic detectors**, not state-of-the-art. Their value is in providing cheap, fast, interpretable signals that can be computed alongside the more sophisticated morphological metrics. In the composite scoring framework, they carry low weights (0.05 each).

### Honest Limitations

This approach has significant limitations that must be acknowledged before any claim of novelty or utility:

1. **FST false rejection rate.** The FST will reject valid words that are not in its lexicon — loanwords, neologisms, proper nouns, code-mixed terms. This inflates the morphological error rate. The false rejection rate has not been formally measured on a representative corpus of Cree text. Without this measurement, the FST validity metric's precision is unknown.

2. **Dictionary coverage.** The semantic validator's quality depends entirely on the Wolvengrey dictionary's coverage. Cree words not in the dictionary produce no glosses, which the validator treats as a meaning gap. The dictionary contains roughly 18,000–22,000 entries (counts vary by edition and counting method) — substantial, but not exhaustive.

3. **Variant class completeness.** The linter's six variant classes were designed based on linguistic literature and observation of MT output patterns. There may be additional equivalence classes not captured — dialectal variations, register differences, discourse-level synonyms. No formal process ensures completeness.

4. **No human correlation study.** The most critical gap: nobody has measured whether the linter's verdicts (EXACT/EQUIVALENT/MISS) or the semantic validator's verdicts correlate with human judgments of translation quality. Neural metrics spend years establishing correlation with human assessment (WMT shared tasks). Our metrics have no such validation.

5. **Language specificity.** The variant classes, synonym lists, and optional particle rules are specific to Plains Cree. Porting them to North Sámi, Inuktitut, or any other language requires linguists who understand that language's morphology, word order flexibility, and orthographic variation. The *framework* is portable; the *rules* are not.

6. **Metric wiring gaps.** As of this writing, four of the nine metrics in the composite scoring profile (semantic_score, morphological_accuracy, equivalent_match_rate, orthographic_accuracy) have incomplete or unclear plugin wiring in the arena harness. The composite score is effectively computed from approximately five metrics with redistributed weights.

### What Would Be Required to Validate This Approach

To make this work publishable — in any venue, at any level of academic seriousness — the following experiments would be required:

1. **Human judgment correlation study.** Collect human quality assessments for a set of English→Cree translations (ideally 200+ sentence pairs assessed by 3+ bilingual speakers). Compute correlations between human scores and each of our metrics. This is the single most important validation. Without it, the metrics are engineering artifacts, not evaluation tools.

2. **FST false rejection rate measurement.** Run the FST analyser on a corpus of known-good Cree text (e.g., published Cree texts, validated parallel corpora) and measure what percentage of valid words are rejected. This quantifies the precision of the FST validity metric.

3. **Second-language validation.** Port the FST validity metric to a second GiellaLT language (most likely North Sámi, which has the most mature FST analyser in the GiellaLT ecosystem). Demonstrate that the metric produces sensible results on Sámi MT output. This validates the claim of extensibility.

4. **Comparison with COMET.** Run COMET on the same Cree data and compare its scores with our metrics and with human judgments. If COMET produces meaningful scores for Cree (which we doubt, but have not tested), our metrics need to beat it to be useful. If COMET produces noise (which we expect), this validates the need for our approach.

5. **MorphEval diagnostic complement.** Build a small (50–100 contrasts) MorphEval-style test suite for Plains Cree targeting the language's most distinctive morphological features (obviative, inverse, conjunct/independent, inclusive/exclusive). Run MT systems against it and show that the diagnostic information is actionable.

6. **Wiring and integration audit.** Fix the scoring profile wiring gaps identified in the codebase inventory. Ensure that all nine composite metrics produce values and that the aggregate score is computed correctly.

---

## Part 7: Positioning and Future Work

### Where LYSS Sits in the Evaluation Landscape

A taxonomy of MT evaluation approaches, positioned honestly:

| Dimension | String metrics (BLEU, chrF++) | Neural metrics (COMET, MetricX) | LLM-as-judge (GEMBA) | Diagnostic (MorphEval, CheckList) | **LYSS** |
|-----------|-------------------------------|---|----|-------|--------|
| Signal type | Surface overlap | Learned semantic similarity | Open-ended judgment | Targeted capability probes | Morphological validity + rule-based equivalence |
| Training data needed | None | Human judgments (thousands) | Pre-trained LLM | Linguist-designed test suites | FST + dictionary + variant rules |
| LRL applicability | Universal but weak | Limited by encoder coverage | Limited by LLM coverage | Limited by test suite creation | Limited by FST availability (~30 languages) |
| Reference needed | Yes | Yes (or source-only QE) | Optional | Yes (contrastive) | Yes (LYSS-eq/LYSS-sem) / No (LYSS-fst) |
| Interpretability | Low (a number) | Low (a number) | High (text rationale) | High (pass/fail per phenomenon) | High (verdicts + variant classes) |

**LYSS is not**: a replacement for COMET on well-resourced languages, a universal metric, or the first morphology-aware evaluation.

**LYSS is**: an integrated framework that combines FST-based morphological validation with standard metrics for the specific case of languages where neural metrics lack coverage and rule-based tools (FSTs, dictionaries) exist. It has three core components:
- **LYSS-fst** — Morphological validity via FST (`fst_acceptance_rate`)
- **LYSS-eq** — Linguistic equivalence via the linter (`equivalent_match_rate`)
- **LYSS-sem** — Deterministic semantic validation (`semantic_score`)

**LYSS extends**: MorphEval's core insight (use morphological tools for evaluation) from diagnostic competence testing to continuous quality scoring.

**LYSS complements**: chrF++ (which gives partial credit for shared morphemes but cannot detect equivalence), COMET (which operates in semantic space but lacks training data for LRL), and FUSE (which uses feature engineering but not morphological analysers).

**The closest prior art is**: Hjerson (linguistic error classification) + HyTER (equivalence classes via paraphrase networks) + Apertium's naïve coverage metric (FST-based validity checking). LYSS's contribution is not any single technique but the integration of these ideas — particularly FST-based validity and rule-based equivalence — into a working evaluation harness for a polysynthetic language.

### Integrating MorphEval

MorphEval's contrastive test suite methodology and our continuous scoring approach are complementary:

- **MorphEval** answers: "Can this system handle tense marking? Number agreement? Case assignment?"
- **Our FST metric** answers: "Did this system produce real words?"
- **Our linter** answers: "Is this translation equivalent to the reference despite surface differences?"
- **Our semantic validator** answers: "Does this translation mean the right thing?"

MorphEval is open source. Creating a Plains Cree test suite would require a linguist to design contrastive pairs covering Cree-specific morphological contrasts (obviation, inverse marking, conjunct/independent order, inclusive/exclusive "we," preverb chains). This is substantial but bounded work — weeks, not months — and would provide diagnostic capability that no other evaluation tool offers for Cree.

### The Extensibility Question

Which other languages could adopt this approach? The primary constraint is FST availability. The GiellaLT infrastructure provides morphological analysers for 30+ languages, primarily in three families:

- **Sámi languages** (North Sámi, Lule Sámi, South Sámi, Skolt Sámi, Inari Sámi): Mature FSTs with broad coverage. North Sámi is the most immediately portable target.
- **Uralic languages** (Finnish, Estonian, Komi, Erzya, Moksha): Well-developed analysers, though Finnish and Estonian may not need FST-based evaluation as urgently (they have more neural metric coverage).
- **Indigenous Arctic languages** (Inuktitut via Uqailaut, Greenlandic): Analysers exist but coverage varies.
- **Other GiellaLT languages**: Faroese, Irish, Cornish, Livonian, and others with varying levels of FST maturity.

Beyond GiellaLT, the **Apertium** platform provides morphological analysers for approximately 40+ language pairs. The **HFST** ecosystem (Helsinki Finite-State Technology) is the shared infrastructure that both GiellaLT and Apertium use, meaning any Apertium analyser could in principle be plugged into the same FST validity metric.

The practical constraint is not FST availability but **variant class curation**. The linter's equivalence rules require linguistic expertise per target language. For North Sámi, this would require understanding Sámi word order flexibility, orthographic conventions, and dialectal variation. For Inuktitut, it would require understanding polysynthetic morphology at a level comparable to what was done for Cree. The FST validity metric, however, can be deployed immediately for any language with a GiellaLT analyser — no additional linguistic work required.

### Toward a Paper

A publication based on this work would most naturally target one of these venues:

- **WMT Metrics Shared Task** (co-located with EMNLP): The most direct venue. Would require implementing the metrics as a shared-task submission and evaluating on WMT test sets — which currently do not include any polysynthetic language. Could submit as a "findings" paper or participate in the challenge sets subtask.
- **LREC-COLING** (Language Resources and Evaluation Conference): Natural fit for a resource/tool paper describing the evaluation framework and the linguistic resources it uses (FSTs, dictionaries, variant rules).
- **ACL or NAACL** (main conference): Would require the human correlation study and at least one additional language to meet the bar for a main conference paper.
- **AmericasNLP workshop**: The most receptive audience for Indigenous language MT evaluation. Lower publication bar, but high impact within the target community.
- **ComputEL** (Computational Approaches to Endangered Languages): Focused venue for exactly this type of work.

Any publication would require co-authors with expertise in Cree linguistics (to validate the variant classes and interpret results) and ideally bilingual Cree speakers (to provide the human quality assessments for the correlation study). This is not optional — a paper about Cree MT evaluation written entirely by non-Cree-speakers would be, at best, incomplete, and at worst, a continuation of the extractive research dynamics that the field is trying to move past.

---

## Appendix A: Metric Requirements Matrix

| Metric | Reference needed? | Source needed? | Trained model? | Language-specific resources? | Works for LRL? |
|--------|-------------------|---------------|----------------|------------------------------|----------------|
| BLEU | Yes | No | No | No | Poorly |
| chrF++ | Yes | No | No | No | Better than BLEU |
| METEOR | Yes | No | No | Stemmer + WordNet | Only if resources exist |
| TER | Yes | No | No | No | Same as BLEU |
| BERTScore | Yes | No | Yes (mBERT) | No | Depends on model coverage |
| BLEURT | Yes | No | Yes (trained) | No | Depends on training data |
| COMET | Yes | Yes | Yes (XLM-R) | No | Depends on XLM-R coverage |
| CometKiwi | No | Yes | Yes (XLM-R) | No | Depends on XLM-R coverage |
| GEMBA | Optional | Yes | Yes (LLM) | No | Depends on LLM coverage |
| **FST acceptance** | **No** | **No** | **No** | **Yes (FST analyser)** | **Yes, if FST exists** |
| **CRK Linter** | **Yes** | **No** | **No** | **Yes (FST + variant rules)** | **Yes, if resources exist** |
| **CRK Semantic** | **Yes** | **Optional** | **No** | **Yes (FST + dictionary + spaCy)** | **Yes, if resources exist** |
| Hallucination det. | No | Yes | No | No | Yes |
| Code-switching det. | Optional | Yes | No | Minimal | Yes |
| MorphEval | Yes (contrastive) | Yes | No | Yes (test suite + analyser) | Only if test suite exists |

## Appendix B: Key Papers

| Citation | Venue | Relevance |
|----------|-------|-----------|
| Papineni et al. (2002). BLEU: a Method for Automatic Evaluation of Machine Translation | ACL 2002 | The metric that defined the field |
| Doddington (2002). Automatic Evaluation of Machine Translation Quality Using N-gram Co-Occurrence Statistics | HLT 2002 | Information-weighted n-gram matching |
| Banerjee & Lavie (2005). METEOR: An Automatic Metric for MT Evaluation | ACL 2005 Workshop | Stemming, synonyms, word alignment |
| Snover et al. (2006). A Study of Translation Edit Rate | AMTA 2006 | Edit distance with phrase shifts |
| Popović & Ney (2011). Morphemes and POS tags for n-gram based evaluation metrics | WMT 2011 | Hjerson error classification |
| Dreyer & Marcu (2012). HyTER: Meaning-Equivalent Semantics for Translation Evaluation | NAACL-HLT 2012 | Equivalence classes via paraphrase networks |
| Lommel et al. (2014). Multidimensional Quality Metrics | — | MQM error typology |
| Popović (2015). chrF: character n-gram F-score for automatic MT evaluation | WMT 2015 | Character-level evaluation |
| Popović (2017). chrF++: words helping character n-grams | WMT 2017 | Character + word n-gram evaluation |
| Burlot & Yvon (2017). Evaluating the Morphological Competence of Machine Translation Systems | WMT 2017 | Contrastive morphological test suites |
| Sennrich (2017). How Grammatical is Character-level Neural Machine Translation? | EACL 2017 | LingEval97 contrastive pairs |
| Isabelle, Cherry & Foster (2017). A Challenge Set Approach to Evaluating Machine Translation | EMNLP 2017 | Targeted structural divergence testing |
| Post (2018). A Call for Clarity in Reporting BLEU Scores | WMT 2018 | sacreBLEU standardisation |
| Reiter (2018). A Structured Review of the Validity of BLEU | Computational Linguistics | Meta-analysis of BLEU's correlation with human judgment |
| Stanovsky, Smith & Zettlemoyer (2019). Evaluating Gender Bias in Machine Translation | ACL 2019 | WinoMT gender evaluation |
| Ribeiro et al. (2020). Beyond Accuracy: Behavioral Testing of NLP Models with CheckList | ACL 2020 (Best Paper) | Capability-based unit testing for NLP |
| Zhang et al. (2020). BERTScore: Evaluating Text Generation with BERT | ICLR 2020 | Embedding-based semantic similarity |
| Sellam et al. (2020). BLEURT: Learning Robust Metrics for Text Generation | ACL 2020 | Pre-trained + fine-tuned metric |
| Rei et al. (2020). COMET: A Neural Framework for MT Evaluation | EMNLP 2020 | Cross-lingual trilingual evaluation |
| Freitag et al. (2021). Results of the WMT 2021 Metrics Shared Task | WMT 2021 | MQM-based meta-evaluation |
| Thompson & Post (2020). PRISM: Automatic MT Evaluation via Zero-Shot Paraphrasing | EMNLP 2020 | Multilingual NMT as paraphrase scorer |
| Currey et al. (2022). MT-GenEval | EMNLP 2022 | Counterfactual gender accuracy |
| Amrhein et al. (2022). ACES: Translation Accuracy Challenge Sets | WMT 2022 | 68 phenomena, 146 language pairs |
| Kocmi & Federmann (2023). GEMBA: Large Language Models Are State-of-the-Art Evaluators | EAMT 2023 | LLM-as-evaluator |
| Guerreiro et al. (2024). xCOMET: Transparent MT Evaluation through Fine-grained Error Detection | TACL 2024 | Error span detection |
| Wang & Adelani (2024). AfriMTE and AfriCOMET | NAACL 2024 | Neural metrics for African languages |
| Juraska et al. (2024). MetricX-24 | WMT 2024 | mT5-based winning metric |

## Appendix C: Glossary of Evaluation Terms

| Term | Definition |
|------|------------|
| **Adequacy** | Whether a translation conveys the meaning of the source. |
| **Fluency** | Whether a translation is grammatical and natural in the target language. |
| **Direct Assessment (DA)** | Human evaluation method where annotators rate translations on a 0–100 scale. |
| **MQM** | Multidimensional Quality Metrics — error-span-based human evaluation with typed severities. |
| **Quality Estimation (QE)** | Predicting translation quality without a reference translation. |
| **FST** | Finite-State Transducer — a computational device that encodes a language's morphological rules. |
| **GiellaLT** | Infrastructure for rule-based language technology, primarily for Sámi and other Arctic languages. |
| **HFST** | Helsinki Finite-State Technology — the software framework underlying GiellaLT and Apertium. |
| **SRO** | Standard Roman Orthography — the Latin-based writing system for Plains Cree. |
| **Syllabics** | Canadian Aboriginal Syllabics — an abugida writing system used for Cree and other Algonquian languages. |
| **Polysynthetic** | A language type where a single word can encode the equivalent of an entire English sentence through extensive affixation. |
| **Obviation** | A grammatical category in Algonquian languages that distinguishes between two third-person referents. |
| **Inverse** | A voice-like category in Algonquian languages marking that the patient outranks the agent on the animacy hierarchy. |
| **WMT** | Conference on Machine Translation — the primary venue for MT shared tasks and evaluation. |
| **Contrastive evaluation** | Testing whether a system can distinguish minimally-different inputs that require different outputs. |
| **Challenge set** | A crafted test suite targeting specific linguistic phenomena. |
| **Equivalence class** | A set of different surface forms that represent the same meaning and should receive the same evaluation score. |

## Where this leads on this site

Champollion's own answers to the problems catalogued here are the
[Scoring Specification](/docs/network/specifications/scoring) (which metric
counts, and when), [Metric Reliability](/docs/network/specifications/metric-reliability)
(which metric to trust per target language), and the
[Corpus Design Framework](/docs/network/specifications/corpus-design)
(how a test set earns the right to be believed).
