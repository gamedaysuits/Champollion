---
sidebar_position: 5
title: Support a Low-Resource Language
related:
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "The first step for an uncovered language"
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
  - label: "Plains Cree, the trading card"
    to: https://champollion.dev/trading-cards?q=crk
    kind: card
    note: "The proof-of-concept language, as a card"
---

# Support a Low-Resource Language

> **Executive Summary.** A comprehensive guide to building machine translation for low-resource and polysynthetic languages. Covers why these languages are hard (morphological complexity, sparse data, hallucination), existing computational resources (ALTLab FST, GiellaLT, Apertium, UniMorph, EdTeKLA), 10+ approach strategies, the champollion coaching system, and the evaluation loop. Start here if you want to contribute a method for an underserved language.

:::info[Status: Under Active Development]
Plains Cree (nêhiyawêwin) support is currently under development. The tools, evaluation harness, and leaderboard described here are real and usable today, but the Cree translation pipeline has not yet been released. When it is, this will serve as the blueprint for other polysynthetic and low-resource languages with FST infrastructure.
:::

## The Unsolved Problem

Google's Cloud Translation service lists 194 languages ([Google's published list](https://docs.cloud.google.com/translate/docs/languages)). Meta's OMT-1600 (March 2026) claims coverage for 1,600 — the largest MT system ever published. But for the ~1,200 languages in its long tail — our arithmetic: the 1,600 it covers minus the 400+ its authors report the models "understand sufficiently well" — quality is below usable thresholds, training data is dominated by Bible text, the model weights are not available for download, and there is no independent evaluation or community governance framework. For the remaining ~5,400 languages, no pretrained model produces any output at all.

The landscape has shifted significantly — Big Tech is now investing in LRL coverage. But coverage is not quality, and quality without independent verification is not trust. Low-resource languages need more than a model that claims to cover them — they need independent evaluation with morphological validation, community-curated corpora, and sovereignty-respecting governance.

**champollion was built to change that.**

The [Method Leaderboard](https://champollion.dev/leaderboard) is an open challenge: build the best translation method for an underserved language, prove it with reproducible evaluation, and claim the top score. Anyone in the world can contribute — linguists, ML researchers, community language workers, students, hobbyists. The problem is unsolved. The infrastructure is here. The leaderboard is waiting.

---

## Why This Is Hard: Polysynthetic Morphology

Most commercial MT systems were designed for languages like English, French, and Chinese — languages where words are relatively short and sentences are built from discrete tokens. But many Indigenous languages, including Plains Cree, are **polysynthetic**: a single word can encode what English expresses as an entire sentence.

### The Cree example

Consider the Plains Cree word:

> **ê-kî-nitawi-kîskinwahamâkosiyân**
> *"when I went to school"*

That's **one word**. It encodes tense (past), direction (going to), the root (learn), voice (passive/reflexive), and person (first singular). An LLM trained predominantly on English has no intuition for this kind of morphological density.

The challenges compound:

| Challenge | What It Means |
|-----------|--------------|
| **Morphological complexity** | A single verb root can generate thousands of valid inflected forms through prefixation, suffixation, and circumfixation |
| **Animate/inanimate distinction** | Nouns are grammatically animate or inanimate — this affects verb conjugation, demonstratives, and pluralization. The classification doesn't always follow biological animacy (*askiy* "earth" is animate; *maskisin* "shoe" is animate too) |
| **Obviation** | Third-person references are ranked by proximity/salience. The "proximate" and "obviative" distinction has no English equivalent |
| **Sparse training data** | LLMs have seen very little Plains Cree text. What they have seen may mix dialects (Y-dialect, TH-dialect) or orthographies (SRO vs. syllabics) |
| **Weak commercial baseline** | OMT-1600 includes CRK at R1 (Very Low Resource) tier with Bible-domain training and standard BPE tokenization. Google Translate does not support Cree. Independent evaluation with morphological metrics is what makes these baselines meaningful. |

Translation of polysynthetic languages remains an **open research problem** — OMT-1600 includes polysynthetic languages but uses standard BPE tokenization (256K vocabulary) with no morphological awareness, meaning it shreds compositional words into meaningless byte fragments.

---

## Prior Art: How People Have Approached This

### The ALTLab FST

The most significant computational resource for Plains Cree is the **finite-state transducer (FST)** developed by the [Alberta Language Technology Lab (ALTLab)](https://altlab.ualberta.ca/) at the University of Alberta, in collaboration with [Giellatekno](https://giellatekno.uit.no/) at UiT The Arctic University of Norway.

The ALTLab FST is a **morphological analyzer and generator**: given an inflected Cree word, it can decompose it into its root and grammatical tags, and given a root plus tags, it can generate the correct inflected form. This is deterministic — no neural network, no hallucination, no probability. If the FST accepts a word, that word is morphologically valid.

This is why the champollion leaderboard tracks **FST Acceptance Rate** as a metric. A translation method that produces words the FST rejects is producing morphologically invalid Cree — regardless of what the chrF++ score says.

**Key ALTLab resources:**
- [itwêwina](https://itwewina.altlab.app/) — an intelligent Plains Cree–English dictionary powered by the FST
- [Morphodict](https://github.com/UAlbertaALTLab/morphodict) — open-source morphologically-aware dictionary platform
- [crk-db](https://github.com/UAlbertaALTLab/crk-db) — Plains Cree lexical database
- [21st Century Tools for Indigenous Languages](https://21c.tools/) — the broader project context

### Global FST & Morphological Registries

Plains Cree is not the only language with high-quality FST infrastructure. If you want to develop translation pipelines for other low-resource or morphologically complex languages, you can tap into these established global hubs:

* **[GiellaLT / Giellatekno](https://giellalt.github.io/) (UiT The Arctic University of Norway):** The largest repository of open-source FST morphological analyzers and generators, covering over 100 languages. Focus areas include Sámi languages (`sme`, `smj`, `sma`, etc.), Uralic languages (Komi, Erzya, Udmurt, etc.), and other minority/indigenous languages. They host public processed text corpora (`corpus-xxx`) in their [GitHub Organization](https://github.com/giellalt/).
* **[The Apertium Project](https://www.apertium.org/):** An open-source rule-based machine translation platform. Apertium maintains highly optimized FST morphological analyzers (using `lttoolbox` and `hfst`) and bilingual dictionaries for dozens of languages, including a large suite of Turkic languages (Kazakh, Tatar, Kyrgyz, etc.) and minority European languages. All resources are public on [Apertium's GitHub](https://github.com/apertium).
* **[UniMorph (Universal Morphology)](https://unimorph.github.io/):** A collaborative project providing standardized morphological paradigms for over 150 languages. The dataset is hosted on Hugging Face at [unimorph/universal_morphologies](https://huggingface.co/datasets/unimorph/universal_morphologies). If a compiled FST binary is unavailable for a language, UniMorph tables can be used as a static database lookup gate.
* **[National Research Council Canada (NRC)](https://nrc-digital-repository.canada.ca/):** Offers tools for Canadian Indigenous languages, including the **Uqailaut** Inuktitut FST morphological analyzer and the massive **Nunavut Hansard Parallel Corpus** (1.3M aligned English-Inuktitut sentence pairs).

### The EdTeKLA Corpus

The [EdTeKLA research group](https://spaces.facsci.ualberta.ca/edtekla/) (also at UAlberta) has assembled a Plains Cree language corpus from educational materials, audio transcriptions, and community sources. The champollion evaluation dataset [EDTeKLA Dev v1](/docs/network/leaderboard/datasets) is derived from this work, published under [EdTeKLA's modified CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (sovereignty-scoped, non-commercial terms).

### Other approaches people have tried or could try

The leaderboard is method-agnostic. Here are strategies that have been explored or proposed for low-resource MT, any of which could be submitted:

| Approach | How It Works | Pros | Cons |
|----------|-------------|------|------|
| **[Coached LLM prompting](/docs/network/tutorials/coached-llm-prompting)** | Inject grammar rules, dictionaries, and example pairs into the system prompt | Fast to iterate, no training needed | Quality ceiling limited by LLM's base knowledge |
| **[Few-shot prompting](/docs/network/tutorials/few-shot-prompting)** | Include verified translations as in-context examples | Good for consistent style | Small context window; examples must NOT come from eval data |
| **[FST-gated pipeline](/docs/network/tutorials/fst-gated-pipeline)** | LLM generates → FST validates → rejects and retries invalid morphology | Guarantees morphological validity | Requires FST infrastructure; retry loops add latency and cost |
| **[Dictionary lookup + LLM](/docs/network/tutorials/dictionary-augmented-llm)** | Force known terms from a bilingual dictionary, let LLM handle the rest | Reduces hallucination for known terms | Dictionary coverage is always incomplete |
| **[Fine-tuned model](/docs/network/tutorials/fine-tuned-model)** | Fine-tune an open model (Llama, Mistral) on parallel text — just not on the eval data | Potentially highest quality | Requires parallel corpus (scarce); expensive; overfitting risk |
| **[Chained models](/docs/network/tutorials/chained-models)** | Model A generates rough translation → Model B post-edits → Model C scores | Can combine specialist strengths | Complex; slow; expensive |
| **[Rule-based + LLM hybrid](/docs/network/tutorials/rule-based-hybrid)** | Use linguistic rules for known patterns, LLM for everything else | Precise where rules apply | Requires deep linguistic expertise |
| **[Back-translation augmentation](/docs/network/tutorials/back-translation)** | Generate synthetic parallel data by translating Cree→English, then training on the reverse | Expands training data cheaply | Amplifies existing model errors |
| **[Evolutionary approach](/docs/network/tutorials/evolutionary-approach)** | Generate candidate translations, score them, mutate the best performers, repeat | Can discover novel solutions; parallelizable | Computationally expensive; needs a good fitness function |
| **[Partial translation](/docs/network/tutorials/partial-translation)** | Manually translate a representative sample, prove your method matches your style on it, then auto-translate the remaining bulk | Combines human quality with machine scale | Requires initial human effort |
| **Manual JSON / exam grading** | Hand-craft a dataset JSON file to test student answers on a language exam, or grade a batch of human translations against a gold standard | Zero ML required; works for education and QA | Doesn't scale to ongoing translation needs |

### It's just JSON

The harness takes JSON in and scores JSON out. The [dataset format](/docs/network/leaderboard/datasets) is simple:

```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

You can construct this by hand. You can export it from a spreadsheet. You can generate it from a corpus. A language teacher could use it to score student translations. A translation agency could use it to benchmark freelancers. A research lab could use it to compare model architectures. The harness doesn't care where the JSON came from — it just scores it.

And because the production deployment framework takes the same plugin interface, a method that scores well in the harness deploys to your website with one config change. **Prove it and use it.**

The possibilities are genuinely endless. **If you have an idea, build it, run the harness, and submit your scores.**

---

## How champollion Fits In

champollion provides the infrastructure layer — you bring the method.

### The coaching system

champollion's `llm-coached` method lets you inject linguistic knowledge directly into the LLM prompt:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation, demonstratives, and pluralization",
    "Use SRO (Standard Roman Orthography) as the working script — syllabic conversion is handled by the deterministic converter",
    "Obviation: when two third-person referents appear, the less salient one takes obviative marking (-a suffix on nouns, -iyiwa on verbs)"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "dashboard": "kīskinwahamākēwin-māsinahikan"
  },
  "style_notes": "Use formal register appropriate for educational and community contexts. Preserve English technical terms in parentheses when no Cree equivalent exists or is widely accepted."
}
```

The coaching data is injected into every LLM prompt for the `en:crk` pair, giving the model structured linguistic context it wouldn't otherwise have. See [Coaching Data](https://champollion.dev/docs/concepts/coaching-data) for the full specification.

### Registers

The register is part of the system prompt that steers tone, formality, and orthographic conventions. champollion ships with one Plains Cree register:

```
nêhiyawêwin (Plains Cree). Use SRO (Standard Roman Orthography) as the working
script. Output will be converted to Syllabics via deterministic converter.
Professional register appropriate for educational and community contexts.
```

You can override this in your config to experiment with different prompting strategies:

```json title="champollion.config.json"
{
  "languages": {
    "crk": {
      "register": "Casual Plains Cree (Y-dialect). Use SRO. Prefer everyday vocabulary over formal or archaic terms. Address the reader directly."
    }
  }
}
```

Different registers produce different translation styles — and different scores on the leaderboard. Each submission records the exact register and system prompt used (as a SHA-256 hash in the [run card](/docs/network/specifications/run-card)), so experiments are reproducible.

### Script conversion

Plains Cree is written in two scripts: **Standard Roman Orthography (SRO)** and **Canadian Aboriginal Syllabics**. champollion's pipeline:

1. LLM translates into SRO (Latin-based, which LLMs handle better)
2. Quality gate validates the SRO output
3. Deterministic converter transforms SRO → Syllabics
4. Converted text is written to disk

The converter handles all SRO diacritics (ê, î, ô, â for long vowels) and maps them to the correct syllabic characters. See [Script Converters](https://champollion.dev/docs/concepts/script-converters) for technical details.

### The evaluation loop

The [eval harness](/docs/network/specifications/harness) runs your method against the evaluation dataset and produces a scored [run card](/docs/network/specifications/run-card):

```bash
# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness

# Run a baseline experiment
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v7

# Run with FST validation (the default LLM method gates on the FST)
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --fst-retries 3 \
  --name fst-gated-v1
```

The `--name` flag is a label you choose. It appears on the leaderboard so people can see what prompt strategy you used. The harness records the full system prompt in the run card, so your exact approach is reproducible.

:::tip[Experiment freely, submit your best]
The harness is designed for rapid iteration. Run dozens of experiments with different models, coaching data, registers, and conditions. Only submit to the leaderboard when you have something you're proud of.
:::

---

## Data-Sovereignty Principles {#data-sovereignty-principles}

champollion is designed to support Indigenous data sovereignty. Community ownership, control, access, and possession of language data guide how we approach language technology for Indigenous communities:

| Principle | How champollion supports it |
|-----------|------------------------|
| **Ownership** | Language communities own their linguistic data. champollion never phones home or transmits data to our servers |
| **Control** | The [API method](https://champollion.dev/docs/guides/serving-a-method) allows communities to host their own translation pipeline — we provide the interface, they control the implementation |
| **Access** | Communities decide who can use their method. The API can be gated behind authentication |
| **Possession** | All translation data stays in your project's file system. The [provenance system](https://champollion.dev/docs/concepts/security) tracks where every translation came from |

The plugin architecture means a community can build a method that incorporates sacred or restricted knowledge internally, expose only the translation API, and maintain full control over their linguistic resources.

---

## The Vision: What Comes Next

Plains Cree is the first target. Once the pipeline is validated and the community is satisfied with quality, the same architecture extends to other polysynthetic languages with FST infrastructure:

- **Other Algonquian languages**: Woods Cree, Swampy Cree, Ojibwe, Blackfoot
- **Inuit languages**: Inuktitut, Inuinnaqtun (which also use syllabic scripts)
- **Other language families**: any language with an FST analyzer can use the FST-gated pipeline

The leaderboard is language-pair-scoped. As new evaluation datasets are contributed by language communities, new leaderboard tracks open automatically.

**This is an open invitation.** If you work with a low-resource language — as a researcher, a community member, a student, or just someone who cares — champollion gives you the tools to build something real, measure it honestly, and share it with the world. The [Method Leaderboard](https://champollion.dev/leaderboard) is waiting for your submission.

---

## See Also

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — submit your scores and see how methods compare
- **[MT Evaluation](/docs/network/leaderboard/rules)** — what makes a good method, what gets disqualified
- **[Eval Harness](/docs/network/specifications/harness)** — how to run experiments
- **[Evaluation Datasets](/docs/network/leaderboard/datasets)** — EDTeKLA Dev v1 and FLORES+
- **[Coaching Data](https://champollion.dev/docs/concepts/coaching-data)** — how to structure linguistic knowledge for the LLM
- **[Script Converters](https://champollion.dev/docs/concepts/script-converters)** — the SRO→Syllabics pipeline
- **[Serving a Method via API](https://champollion.dev/docs/guides/serving-a-method)** — hosting community-controlled translation
- **[ALTLab](https://altlab.ualberta.ca/)** — the Alberta Language Technology Lab
- **[EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/)** — the Educational Technology, Knowledge & Language research group
- **[itwêwina dictionary](https://itwewina.altlab.app/)** — FST-powered Plains Cree–English dictionary

