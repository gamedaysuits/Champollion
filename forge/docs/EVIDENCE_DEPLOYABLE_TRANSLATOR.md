# Evidence appendix: building a deployable translator for the hardest pair

*Draft, 2026-10-14, revised after two adversarial reviews (a field linguist's
and an MT researcher's). This is the evidence behind the
[community guide](BUILDING_A_DEPLOYABLE_TRANSLATOR.md) and the
[agent's playbook](AGENT_PLAYBOOK_DEPLOYABLE_TRANSLATOR.md). Every claim is
listed, with its file, source and confidence, in
[`BUILDING_A_DEPLOYABLE_TRANSLATOR.claims.json`](BUILDING_A_DEPLOYABLE_TRANSLATOR.claims.json).
§E9 lists what the reviews corrected; §E10 lists what we did not change, and
why.*

## E0. How to read this

| Measure | Range | What it measures | Limit |
|---|---|---|---|
| chrF++ | 0 to 100 | Overlap of letters and words with a reference translation (Popović 2017; sacreBLEU, word order 2) | Gives partial credit to a wrong ending that changes the meaning |
| BLEU | 0 to 100 | Overlap of whole words and word sequences | One wrong ending makes the whole word wrong |
| Exactly right | % of sentences | Identical to a reference translation | A floor on meaning: a right translation phrased differently counts as wrong |
| Meaning-right | % of sentences | A fluent speaker judges the meaning right | The measure that matters; needs speakers |

Compare numbers only within one row or one study.

**Markers.** **[KL]** measured with forge on Klingon (Tatoeba); an easier case
than the hardest pair (§E1). **[INV]** measured with forge on its invented,
perfectly regular test language: an *upper bound on quality*, but a *lower
bound on interval width* (near-perfect outputs vary less, so intervals come
out narrower than on a real language). **[derived]** our arithmetic.
**[not yet proven]** no published study and no forge run has measured it for
this kind of language. **[policy]** a choice, not a finding.

**Agent-judged estimates** are kept in labelled boxes and are never placed
beside speaker-rated results.

## E1. The Klingon test bed [KL]

**What Klingon is, and is not.**

- A constructed language with real writers. **Agglutinative, not
  polysynthetic:** verb prefixes for subject and object, suffixes in fixed
  ordered slots, no noun incorporation. A grammar designed to be regular.
  Written here in Latin transcription.
- **No open model forge can fine-tune knows it.** NLLB-200 has no Klingon code.
  MADLAD-400 3B lists Klingon (it has a `<2tlh>` tag), but with zero pairs it
  scored chrF++ 8.6, got 0 of 1,000 sentences exactly right, and copied the
  English back in 33% of outputs. ByT5's pretraining data (mC4) has no Klingon
  label. A closed commercial service, Microsoft Translator, lists Klingon (per
  a third-party language list; not checked against Microsoft's own pages), and
  Tatoeba's Klingon is inside OPUS and the Tatoeba-Challenge, so models trained
  on those may have seen it.

**The data.**

| Item | Value |
|---|---|
| Source and licence | Tatoeba, CC BY 2.0 FR per sentence (attribution; no share-alike, no non-commercial limit) |
| Training pool | 21,898 pairs by the main author; each ladder size takes the first N |
| test-main | 1,000 sentences, **same author as the training data**; 5.8 English words on average |
| test-other | 1,001 sentences by every other author; never in training |
| dev | 501 sentences |
| Split rule | Rows sharing an English or a Klingon sentence kept together |
| Near-twins | 30% of test-main and 29% of test-other have a similar sentence in the pool (reported, not removed) |
| Links | Tatoeba's downloads hold **direct** translation links only. In a 300-sentence sample, 21.0% (about ±5 points) of Klingon sentences with any English translation reached English only through a third language, so direct-only selection drops them. They are a legitimate, noisier source if kept in their own labelled lane |
| Counts | OPUS lists 16,911 English–Klingon pairs; forge counted about 21,898 from the main author. The two are not yet reconciled |
| Quality | No speaker review has certified the Tatoeba Klingon |

**The curve** (ByT5-small, 24 GB Mac with an M4 Pro chip; greedy decoding):

| Pairs (passes) | chrF++ test-main | chrF++ test-other | Exactly right, test-main | Training time |
|---|---|---|---|---|
| 400 (20) | 11.4 | 12.0 | 0% | 15 min |
| 1,600 (20), two seeds | 26.8 / 21.6 | 24.8 / 20.1 | 2.3% / 0.8% | 40 min |
| 3,200 (20) | 40.2 | 37.4 | 9.5% | 84 min |
| 6,400 (20), two seeds | 52.6 / 53.3 | 48.2 / 49.0 | 18.7% / 19.6% | 4.1–4.2 h (memory-pressured) |
| 12,800 (10) | 56.6 / 56.5 (two seeds) | 52.4 (seed 1) | 23.7% / 23.2% | 2.4–2.6 h |

- forge recorded two exact-match figures that differ by up to about 2.4
  points: its analysis (18.7–19.6% at 6,400; 23.7% at 12,800, seed 1) and its
  scorer's exact-match lane (16.8–17.7%; 21.3%). This appendix reports the
  analysis figure throughout.
- Exactly right on test-other at 12,800: about 25% (one run).
- **Seeds:** the seed alone moved chrF++ 5.2 points at 1,600 pairs and 0.7 at
  6,400; no size between was run twice. forge's own analysis says verdicts can
  flip by chance below about 5,000 pairs.
- **Sentence length** (12,800 pairs): exactly right 31–34% for 1 to 4 English
  words, 23–24% for 5 to 7, 7% for 8 or more.
- **Exactly-right gains per doubling:** +7 to +9, then +9 to +10, then about +4
  points (1,600 to 12,800 pairs).

**Correction: more pairs still improve the translator, slowly.** An earlier
reading said accuracy on sentences whose words were all seen stayed flat from
6,400 to 12,800 pairs, so that more random pairs bought only word coverage.
That compared a different set of sentences at each size, and is withdrawn. On
one fixed set (the 309 test-main sentences in vocabulary at 6,400 pairs:
every English word and every word of the reference seen in training), exactly
right rose from **37.5–38.2%** (6,400, two seeds) to **42.4–42.7%** (12,800, two
seeds) and **43.4%** with back-translation (one seed).

**Two "in-vocabulary" definitions** exist in forge's analysis: every word seen
(shares 35% then 47%; accuracy 34–36%) and every English word plus every word
of the reference seen (shares 31% then 43%; accuracy 36–38%). Both compare
different sentences at each size; only the fixed-set figure above measures
change.

**Stems and endings.**

- forge built a measurement-only word splitter from Klingon's published affix
  grammar and stems learned from Tatoeba's own Klingon text (no dictionary). An
  agent, not a speaker, checked it: no stem wrong in 120 random words; 19 of 20
  common words right; 4.8% of words have a near-equal second reading.
- With it, "in-lexicon" sentences (every stem seen, new endings allowed) were
  exactly right 25–26% of the time at 6,400 pairs and 28–29% at 12,800 (a
  different set at each size; levels only). The invented language, with
  in-lexicon shares within 5 points of Klingon's at every size, got 94% [INV].
- One-word misses at 12,800 pairs: **43–44%** a known stem with a wrong ending,
  **51–52%** another known stem, **5%** a stem never in training.

**Decoding and choosing** (12,800 pairs, test-main):

| Method | chrF++ | Exactly right | Time per 1,000 sentences |
|---|---|---|---|
| Greedy | 56.5 | 23.2% | 22 s |
| Beam 4 | 56.9 | 23.2% | 42 s |
| MBR, 16 samples + 8-best | 58.1 | 22.8% | minutes |
| Word-list gate | 55.3–56.1 | 20.8–21.8% | |
| Reverse-model chooser | +1.1 | 23.3% → 23.6% (test-other 24.8% → 25.1%) | |
| Best of 8 by the reference (ceiling) | 67.1 | 38.9% | |

**Back-translation** (12,800 real pairs + 10,196 back-translated Klingon
sentences; one run, one seed): test-main +1.6 chrF++ and +1.7 points exactly
right; test-other +0.9 and +1.1. Training took about twice as long (4.4 h
against 2.5 h). By forge's reading, the lane bought about a third of what
6,400 more real pairs bought between 6,400 and 12,800 pairs (one run, one test
set).

**Memory and time.** The full ByT5-small recipe used about 16 GB of a 24 GB
Mac's GPU memory, ran out of memory at a 12 GB cap (step 1,037), and held 19 GB
uncapped. NLLB-600M full fine-tuning ran out at forge's earlier 16 GB cap at
batch 8 (step 800 of 8,000); NLLB-1.3B with LoRA at step 72. Pausing while a
person used the computer cost 1.1 to 1.5 hours per overnight job. **All of
this is for short, Latin-script, nearly ASCII sentences.**

> **An agent's reading, not a speaker rating.** An agent read 60 one-word
> misses at 12,800 pairs and judged 29 likely acceptable in meaning (95%
> interval 36% to 61% [derived]), which would put meaning-right near 34–40%.
> No speaker has rated Klingon outputs.

**Independent test sets for the Klingon proof.**

- A **commissioned set**: at least 300 new English sentences translated
  independently by at least two qualified Klingon speakers, released by them
  under CC0 or CC BY, sealed until the first headline score, with a blind
  meaning review of 100 outputs.
- ***paq'batlh: The Klingon Epic*** (2nd edition, 2022, CC BY-NC-SA 4.0): an
  expert bilingual text, used only as a labelled **out-of-domain stress test**
  inside the scorer (publish scores only), never for training, and never
  averaged into the headline. It is verse, non-commercial and share-alike, and
  public, so large models may have seen it.

**The invented language [INV].** 79% meaning-right at 6,400 pairs (77–81% over
three seeds) and 86% at 12,800, same recipe and computer. Median width of the
95% interval on a chrF++ difference (60 draws per size from 500 held-out
outputs): about 11 points at 23 sentences, 7–8 at 50, 5.3 at 100, 3.8 at 200.
Expect wider intervals on a real language.

## E2. What has been reached on languages like the hardest pair

**Judged by people:**

| Study | What people judged | Finding |
|---|---|---|
| AmericasNLP 2023 (Ebrahimi et al. 2023) | One native speaker per language rated 50 sampled outputs, for three languages, on a 1 to 5 meaning scale (4 = "general meaning conveyed, some details may be missing") | Top ratings were rare; for Otomí most outputs got the lowest rating |
| AmericasNLP 2021 (Mager et al. 2021) | Adequacy and fluency for Shipibo-Konibo and Otomí | Mean adequacy about 2 of 5; **no visible correlation between chrF and the human scores** |
| English to Inuktitut (Knowles & Lo 2022) | Fluent experts' direct assessment | chrF agreed modestly (segment Kendall tau 0.29; sentence BLEU about 0.00) |
| Mapudungun (Thompson et al. 2026) | One second-language annotator, 50 sentences per direction | No consistent preference despite a 3-point chrF++ gap |

In these studies, no system for a polysynthetic language was shown to reach 8
in 10 sentences meaning-right.

**Automatic scores** (not comparable across rows):

| System | Data | Result |
|---|---|---|
| AmericasNLP 2023 best, Spanish into 11 languages | 357 (Chatino) to 125,008 (Quechua) training pairs, plus extra data | chrF 15.3 (Otomí) to 40.4 (Guarani). Ten test sets are translated natural-language-inference sentences, another domain; Chatino's is legal text (39.97 chrF on 357 pairs: few pairs, formulaic domain, high score) |
| WMT20 English to Inuktitut (Knowles et al. 2020) | About 1.3 million parliamentary pairs plus news | chrF 37.9, BLEU 15.8 |
| Nunavut Hansard (Joanis et al. 2020) | About 1.3 million pairs | 20.3 BLEU into Inuktitut against 35.0 out of it; partly a BLEU effect, since BLEU denies credit for long words |
| Mapudungun with NLLB (Thompson et al. 2026) | 55,452 pairs | **Into Mapudungun** 39.9–42.9 chrF++ (600M to 3.3B), no gain from morphology-aware tokenisation. **Out of Mapudungun** 34.9–45.8 across sizes and tokenisations (600M: 34.9 standard, 43.2 with vocabulary-constrained Morfessor) |

## E3. Inputs and data

**Translated texts.**

- *Bilingual, from scratch* (Maillard et al. 2023): 1,000 / 3,000 / 6,000
  professionally translated pairs gave average chrF++ 12.6 / 19.9 / 22.9,
  English into the target, over languages with no other parallel data (the
  table average at 1,000 is 13.2 because some cells are missing).
- *Multilingual, with pre-existing data* (same paper, a different setting): the
  model with the 6,000-pair seed beat the one with back-translation instead
  (up to 2 million sentences per language) in all but one case.

**Related languages and multilingual training.**

| Evidence | Finding |
|---|---|
| Maillard et al. 2023 | Multilingual models with related languages scored about 10–16 chrF++ above bilingual ones on the same 6,000-pair seed (e.g. Venetian 33.5 → 49.5; Sicilian 29.6 → 41.8); the paper does not separate transfer from the extra data |
| AmericasNLP winners | 2021: a multilingual model (Helsinki). 2023: multi-stage multilingual NLLB training (Sheffield). 2025: the organisers' single multilingual NLLB-1.3B fine-tune beat per-language NLLB-3.3B fine-tunes for 12 of 13 languages per track (with extra training sources) (de Gibert et al. 2025) |
| Ortega et al. 2021 | Quechua lifted Asháninka (521 pairs) from 1.3 to 5.9 BLEU; adding Asháninka to Quechua plus Finnish lowered Quechua from 22.6 to 17.0 |
| Roest et al. 2020 | Kalaallisut data slightly lowered chrF into Inuktitut (51.9 → 50.6 / 51.3) |
| Nicolai et al. 2021 | Same-family multilingual Bible training collapsed for Cree and Navajo (incomplete or duplicated targets) but helped Inuit-Aleut languages by 4.2 BLEU on average |
| Neubig & Hu 2018 | Training with a similar high-resource language beat plain adaptation by 1.7 BLEU on average |

**Domain.** The Quechua system that scored 23.4 BLEU in domain scored 1.4 and
0.6 out of domain (Chen & Fazio 2021). Cherokee: 15.8 against 6.5 BLEU
(Zhang et al. 2020). Training only on religious text lost 59–96% of the news
score (Adelani et al. 2022). A religious-corpus benchmark overstated quality on
everyday text (Nekoto et al. 2020). Domain matters, but model choice matters
too (§E4); neither always dominates.

**Cleaning.** Hand-revising a 7,281-pair Nheengatu set to 6,848 pairs gave a
markedly better translator (Pinhanez et al. 2024; test sets differ). Copied
untranslated rows at 5% of the data cut BLEU from 27.2 to 17.6 (Khayrallah &
Koehn 2018; German–English). A mined English–Quechua corpus was 47%
near-duplicates, with 21.8% of the rest in the wrong language (Garcia Gilabert
et al. 2024).

**Back-translation.**

- With a strong reverse model it recovered 67–83% of the gain of the same
  amount of real pairs (Edunov et al. 2018, 640K-pair German–English).
- With a weak reverse model, beam outputs beat sampled ones (same paper).
- The original recipe mixed 1:1 (Sennrich et al. 2016). Tagging the synthetic
  side matches or beats noising (Caswell et al. 2019).
- Ratio: in one high-resource study the best result was at 2 synthetic per
  real, by about 0.007 BLEU (Poncelas et al. 2018); 1:1 gave +0.8 BLEU and 3:1
  +0.6 in another (Fadaee et al. 2017). With tags, larger amounts are used
  (Maillard et al. 2023). Tune the ratio on dev.
- In-domain monolingual text: +5.4 BLEU against +0.3 out of domain (Hoang et
  al. 2018). Bribri: +1.0 BLEU only in domain (Feldman & Coto-Solano 2020).
  Filtered back-translation: +0.8 chrF++ for NLLB-600M (Gu et al. 2023).

**Dictionaries.** A 1,146-entry dictionary added about 1–2 BLEU on top of
monolingual pretraining (Kannada–English; Koneru et al. 2022). A curated
lexicon added +4.9 chrF in a 200-language model; parallel data did more, and
both together most (Jones et al. 2023).

**Grammar books, as used by LLMs** (in-context prompting, not training). Gemini
1.5 Flash, English to Kalamang chrF++: nothing 11.0; explanations only 22.6;
the book's example sentences only 26.6; its wordlist 29.1; the whole book 34.4
(Aycock et al. 2025). Over 16 languages, adding a grammar to a wordlist and
retrieved sentences lowered English-to-X chrF++ from 30.3 to 26.7 (Hus &
Anastasopoulos 2024). **The ranking "texts, then dictionary, then grammar
prose" holds for training an NMT model** (only parallel text trains it); for
LLM prompting, the wordlist beat the example sentences.

**Inflection and paradigms.** Across 30 languages, a Cree among them (paradigms
of 12 to over 700 forms), adding forms the model got wrong helped most, and
adding forms it already got right could lower accuracy (Muradoglu & Hulden
2022; inflection, not translation). 25,056 forms of 792 lemmas in 15 languages
were elicited remotely with bracketed English context (Sylak-Glassman et al.
2016). Consultants' translations are evidence to be checked, not proof
(Matthewson 2004).

**FSTs and segmentation.**

- Word and phrase tools: Ojibwe verbs, mean chrF 0.82 (0 to 1 scale) on a
  self-built 214-verb test (Nguyen et al. 2025); 83.5% of the first 1,500
  generated English-to-Plains-Cree phrases fully well-formed (Arppe 2025). A
  rule-based system won the 2025 Nahuatl word-formation task at 17.5%, where
  most systems scored 0 to 4% (de Gibert et al. 2025).
- One Plains Cree analyser holds 21,232 stems (2022 count; Lane et al. 2022).
- Analyser segmentation lost to plain subwords: Inuktitut 23.3 against 27.7
  BLEU; Guarani 7.1 against 10.5 (Schwartz et al. 2020).
- Unsupervised morphology-aware segmentation beat tuned subwords in 5 of 8
  directions at 7,442 to 14,208 pairs, by up to +4.16 chrF (Spanish to
  Rarámuri), and lost on Nahuatl (Mager et al. 2022).
- Rule-generated Q'eqchi' data: 42.0 BLEU on its own synthetic test, 0.59 on
  real text (Chulzhanov et al. 2026). Swapping and re-inflecting words: +0.4 to
  over +3 BLEU in 11 of 14 non-polysynthetic pairs (Ibn Alam et al. 2024).

**Choosing what to collect.**

- Into English (30,000-pair base, 20,000 added), quality-estimate selection
  beat random by about 2.0, 1.7 and 0.3 BLEU (Swahili, Kinyarwanda, Spanish);
  round-trip-likelihood selection did worse than random; the gains are about
  one standard deviation (Chimoto & Bassett 2022).
- Pure n-gram selection fell 0.4–2.6 BLEU below random in 17 of 18
  Kannada–English cells (Koneru et al. 2022).
- Crowd workers took 11.98 s per word to translate highlighted phrases against
  32.92 s per word for whole sentences (Bloodgood & Callison-Burch 2010).

**Transcription.** At least 10:1 (monologue) or 15:1 (conversation) hours of
work per hour of audio for an experienced, fluent transcriber with good
software; 15:1 to 30:1 for rough transcription plus checking; about 50:1 with
translation (PARADISEC 2010, a rule of thumb, "your mileage may differ"). Expect
more where few people are literate in the language.

## E4. Base models, training and LLMs

**ByT5 against mT5** (Edman et al. 2024): ByT5 scored higher chrF++ at every
size, by up to about 10 points at 400 pairs (large models), on
German/Russian/Portuguese with English and Spanish, languages ByT5 had already
seen in pretraining (a simulation of low resource, not an unseen language).
COMET found the two competitive. ByT5 trained **4–5 times** and translated 5–6
times slower.

**Pretrained translation bases on unseen languages** (Adelani et al. 2022, 16
African languages, half absent from M2M-100's pretraining; English/French into
the languages, average):

| Base (licence) | BLEU | chrF |
|---|---|---|
| M2M-100 418M (MIT) | 15.4 | 41.1 |
| mBART-50 (MIT) | 13.2 | 37.5 |
| ByT5-base (Apache-2.0) | 10.9 | 31.9 |

Out of the languages, M2M-100 17.7 against ByT5 14.1 BLEU. Continued
pretraining on the languages added 0.6–0.9 BLEU for ByT5.

**NLLB on an unseen language** (Limbum study 2026): zero-shot chrF++ 12.5;
from-scratch Transformer 14.5; NLLB-600M fine-tuned on about 7,000–8,800
pairs (reports give 7,070 training pairs and 8,837 pairs; Bible and
dictionary text) 46.7–47.3 on an in-domain test. A new tag initialised from
related languages; learning rate 5e-5. Plains Cree is not among NLLB-200's
languages (NLLB Team 2022).

**LoRA against full fine-tuning** (mixed):

- NLLB-3.3B, LoRA rank 256: Spanish–Quechua 36.40 against 36.39 full;
  Spanish–Guarani 35.24 against 36.13 (Garcia Gilabert et al. 2024).
- NLLB-600M over 13 Indigenous-to-Spanish pairs: full 25.12, OFT 25.06 on
  test, LoRA 25.27 on dev (Stackhouse & Debenedetto 2026; abstract-level).
- mBART-50, about 100k pairs: LoRA 18.6 BLEU against 30.3 full; bottleneck
  adapters 33.3 (Su et al. 2024).
- forge's NLLB preset uses rank 16, for which we found no translation
  evidence.

**General-purpose LLMs.**

- Into Bhili: fine-tuned NLLB-600M chrF++ 35.2, Llama-3-8B 21.2, Qwen3-8B 19.4
  (Singh et al. 2025).
- Into Kalamang, about 1,200 pairs: NLLB-1.3B 34.2, Llama-3.1-8B with LoRA 13.0
  (Aycock et al. 2025).
- 500,000 Spanish-X examples over 11 languages: Llama-3-8B averaged 17.2
  chrF++ (one pass) and 20.9 (five passes); the best system they compared
  against, a multilingual NMT model, scored 26.7 (Iyer et al. 2024).
- Three LLMs prompted Spanish to Wixarika: under 3 BLEU and 21 chrF, output
  unrelated to the source (Gagnier & Kirubakaran 2026).
- LLM editing of NLLB drafts: into Spanish, median +0.6 chrF++ over 13
  languages, worst −11.7 (Chatino); into Awajún 16.67 against 35.09 for the
  draft (Hus, Krasner & Anastasopoulos 2025).
- Hosted long context: Gemini 1.5 Pro with about 250,000 tokens of Kalamang
  material scored 59.0 chrF against 57.0 for a human learner (Gemini Team
  2024; one language, a small test).

**Tuning at small data.** From scratch at 5,000 pairs, a default Transformer
gained +6.0 BLEU from tuning (Araabi & Monz 2020); a tuned RNN went from 0.0
to 16.6 BLEU (Sennrich & Zhang 2019). The evidence for fine-tuning pretrained
bases is thinner. Checkpoint averaging gave +1.69 chrF++ for NLLB-600M (Gu et
al. 2023).

**Memory and hardware.** Full fine-tuning with AdamW holds 16 bytes per weight
before activations; Adafactor about half (Hugging Face documentation; Shazeer
& Stern 2018). Gradient recomputation costs about 30% more time (Chen et al.
2016). Apple chips trained 3–4 times slower than similarly priced NVIDIA
cards in one study (Feng et al. 2025; indicative). T5-family models can
overflow in fp16; use fp32 or bf16 (bf16 on a Mac needs macOS 14).

**Licences** (model cards): ByT5, mT5, MADLAD-400 Apache-2.0; M2M-100,
mBART-50 MIT; NLLB-200 CC BY-NC 4.0, so a fine-tuned NLLB is best treated as
non-commercial adapted material (our reading; not legal advice). forge's own
licence is PolyForm Noncommercial.

**Distillation.** Sequence-level knowledge distillation trains a small student
on a strong teacher's translations (Kim & Rush 2016). We found no measurement
for a polysynthetic language.

## E5. Speaker time and care

| Rate | Basis | s per word | h per 1,000 pairs, 6 English words | h per 1,000 pairs, 10 English words |
|---|---|---|---|---|
| forge's early planning figure | 30 s + 5 s per word; never measured | | 17 | 22 |
| Professional translators, 39 low-resource languages (Maillard et al. 2023) | 200–250 words an hour; Wikipedia-domain sentences, agency professionals; source or target words unstated | 14.4–18 | **24–30** | **40–50** |
| Crowd workers, whole sentences (Bloodgood & Callison-Burch 2010) | 32.92 s per Urdu word, MTurk wall-clock including idle time | 32.9 | 55 | 91 |
| Post-editing good output (Meetei et al. 2020) | 2.93 s per output word | 2.93 | 5 | 8 |
| Post-editing weak output (Meetei et al. 2020) | 16.14 s per output word | 16.14 | 27 | 45 |

- Count length in **English source words**; Klingon's test sentences averaged
  5.8. Outcomes for longer sentences are lower (§E1).
- Typing in a non-Latin script took 4.8 s a word against 2.6 s in Roman script
  (Meetei et al. 2020).
- When an elder dictates to a scribe, total person-hours double.
- No published rate exists for fluent community speakers.

**What a week buys** [derived, professional pace, one fluent person who types]:

| Hours a week | Pairs a week (6 / 10 words) | Weeks to 6,400 pairs (6 / 10 words) |
|---|---|---|
| 2 | 67–83 / 40–50 | 77–96 / 128–160 |
| 9 | 300–375 / 180–225 | 17–21 / 28–36 |
| 20 | 667–833 / 400–500 | 8–10 / 13–16 |

**Care.** Fluent speakers are often over-worked and over-burdened, and few may
be literate enough to transcribe; one listening study could recruit 6
participants for Kanien'kéha where an English one recruited 30 in 30 minutes
(Pine et al. 2022). Elders often work for free; long sessions need rest and
medication breaks and room to express grief over language loss; speakers want
copies of their recordings, returned to them and to community archives, and
some want co-use copyright inherited by their descendants (Liu et al. 2022).
The professional pace above was paid at USD 25.80 an hour on average (Maillard
et al. 2023): a reference point, not the community's rate.

## E6. Evaluation

- **chrF++** correlates better than BLEU with humans for some morphologically
  rich targets (Popović 2017; Knowles & Lo 2022), but AmericasNLP 2021 saw no
  visible correlation for two languages, and a Mapudungun pilot saw no
  preference despite a 3-point gap (§E2). On Klingon, MBR decoding raised chrF++
  by 1.6 while exactly-right fell from 23.2% to 22.8% [KL].
- chrF can look good on bad output: Nigerian Pidgin scored chrF about 60 while
  humans judged 20% of outputs nonsense or the wrong language (Bapna et al.
  2022).
- **Neural metrics** are not evidence for unseen languages: COMET-22 agreed
  with humans less than chrF++ on 6 of 13 African pairs (e.g. Luo 0.062
  against 0.279; Wang et al. 2024); COMET scored a Chinese-script output for a
  Russian reference (0.536) above an empty line (0.316) (Zouhar et al. 2024).
- **What a chrF gap means:** averaged over many language pairs, a 1.0-point
  chrF difference agreed with humans on which system is better 70% of the
  time, and 3.05 points 90% (Kocmi et al. 2024). That is system-level, on large
  WMT-style test sets, mostly high-resource pairs, not a 200-sentence dev set.
- **Judges.** XSTS agreement (Fleiss kappa) averaged 0.55: the mean of 0.43
  (into English) and 0.67 (out of English), ranging 0.12 to 0.99 by language,
  with trained professional raters (Licht et al. 2022). XSTS 3 means "mostly
  equivalent, no significant conflicts in meaning". Three raters on 100 items
  is underpowered for small effects (Card et al. 2020).
- **Community sufficiency** (an analogy from speech synthesis): communities
  said "a few widely respected and community-engaged language speakers" would
  be practically sufficient to assess the pedagogical value of speech models
  (Pine et al. 2022).
- **Thresholds:** the only published translator-productivity thresholds are for
  English to Spanish (sentence BLEU above 45, TER below 30; Parra Escartín &
  Arcedillo 2015).
- **Leakage:** in one reproduction, test items whose answers leaked scored up to
  83.8 BLEU against 30.9–39.2 for clean ones (Toutou et al. 2026,
  abstract-level). Random splits are optimistic (Søgaard et al. 2021).
  Translationese references distort evaluation (Graham et al. 2020).

**Sample sizes for a speaker bar** [derived]. The bar is passed when the
Wilson 95% interval's lower edge is at or above it (Brown et al. 2001). Power
is the exact binomial chance of passing when the true share is as stated.

| True share right | Bar | n for 80% power | Power at the sizes an earlier draft gave |
|---|---|---|---|
| 90% | 80% | about 100–110 | 0.60 at n = 70 |
| 85% | 80% | about 450–480 | 0.51 at n = 250; 0.25 at n = 100 |
| 65% | 50% | about 80–90 | |
| 60% | 50% | about 190–200 | |

With 100 sentences the lower edge reaches 80% only at 88 or more right, and
50% at 60 or more. 80 of 100 right gives an interval of 71% to 87%. The sizes
assume one combined verdict per sentence (both judges must say right);
between-judge variance is not modelled (§E10).

```python
from math import comb, sqrt
def wilson_low(k, n, z=1.959964):
    p = k / n
    return (p + z*z/(2*n) - z*sqrt(p*(1-p)/n + z*z/(4*n*n))) / (1 + z*z/n)
def power(n, p_true, bar):
    k0 = next((k for k in range(n + 1) if wilson_low(k, n) >= bar), None)
    return 0.0 if k0 is None else sum(comb(n, k) * p_true**k * (1-p_true)**(n-k) for k in range(k0, n + 1))
# smallest n with power(n, 0.90, 0.80) >= 0.8 is 100; it stays above 0.8 from about 112
```

## E7. Deployment

- ByT5 translates 5–6 times slower than a subword model (Edman et al. 2024).
- 8-bit CTranslate2 models cost 0.0–0.3 BLEU on two English–German models;
  memory fell from 721 to 516 MB and from 849 to 529 MB (CTranslate2 README).
- Quantising multilingual LLMs: a 1.7% drop on automatic Japanese tasks was
  16.0% in human evaluation (Marchisio et al. 2024). Pruning hurt rare, long-tail
  sentences first (Ahia et al. 2021).
- Back-translation shown to users raised their confidence, not quality (Zouhar
  et al. 2021). Users' trust follows fluency more than adequacy (Martindale &
  Carpuat 2018). Model-uncertainty estimates track human judgement in several
  pairs (Fomicheva et al. 2020).
- Klingon outputs for inputs with a word never seen in training were exactly
  right about 15% of the time, others about 30% [KL].
- Health: a major commercial engine left about 2% (Spanish) and 8% (Chinese) of
  647 emergency-discharge sentences with potential for clinically significant
  harm (Khoong et al. 2019); meaning was preserved in 55% (Armenian) to 94%
  (Spanish) of 400 statements (Taira et al. 2021). Both are high-resource
  languages with commercial engines.

## E8. Governance and community practice

- **CARE:** collective benefit, authority to control, responsibility, ethics
  (Carroll et al. 2020).
- **Interview study** (Mager et al. 2023): 22 people from 12 Indigenous
  communities of the Americas, most in Mexico and the Andes; the authors say it
  does not represent all Indigenous peoples. Views on who should own data split
  with no majority (public and unrestricted; the community; the participating
  speakers; a minority for outside researchers), and the paper reports "a
  strong feeling" that data should be publicly available. Views on releasing an
  experimental system were close to even. Participants worried that learners
  would learn wrongly, feared standardisation and loss of variety, were split on
  health (some would not machine-translate it, others listed it as useful),
  and noted that speakers use their language to keep community discussions
  private. Some wanted ceremonial material excluded; sacred songs and healers'
  material were named.
- **Consent for machine learning.** For the best-known grammar-book benchmark,
  renewed permission came from one of the field linguist's main consultants, and
  the linguist was confident it reflected the community's views (Tanzer et al.
  2024). Treat that as the least the field has accepted, not the standard.
- **Ethics review (Canada):** TCPS 2 (2022), chapter 9, Article 9.1 requires
  community engagement where research is likely to affect an Indigenous
  community's welfare.
- **Archives and labels:** AILLA grades access at four levels, with restrictions
  that can rest on speech-community wishes or ceremonial content; Local Contexts
  Traditional Knowledge Labels mark sacred, gendered and seasonal restrictions.
- **Published is not permitted:** the best-known classic Plains Cree text
  collection is, by its own title, a collection of sacred stories, dictated in
  1925 and freely readable online (Bloomfield 1930).
- **The trilogy.** The grammar, dictionary and texts ("the Boasian trilogy") are
  the products of the descriptive tradition. Documentary linguistics adds
  annotated recordings with metadata and puts them first (Himmelmann 1998;
  Gippert, Himmelmann & Mosel 2006). A trilogy "text" is interlinear: the
  language line, a morpheme gloss, and the linguist's free translation.
- **Practice:** know the community, offer co-authorship, document protocols, be
  explicit about sharing and storage, return copies, edit out sensitive
  material before sharing (Liu et al. 2022).

## E9. Corrections made after the reviews

| Earlier claim | Corrected |
|---|---|
| Accuracy on in-vocabulary sentences was flat from 6,400 to 12,800 pairs, so more random pairs bought only word coverage | Different sentence sets at each size. On a fixed 309-sentence set, exactly right rose 37.5–38.2% → 42.4–42.7% → 43.4% with back-translation [KL] |
| Speaker-sample sizes of about 70 / 250 / 50–60 / 100 | Those give about 50% power. 80%-power sizes are about 100–110 / 450–480 / 80–90 / 190–200; the bar is on the lower edge |
| ByT5 trains 4–6 times slower | 4–5 times (Edman et al. 2024) |
| ByT5's 10-point edge over mT5 as evidence for unseen languages | Measured on high-resource languages ByT5 already knew; COMET found the models competitive |
| M2M-100 beat ByT5 by 3.6–4.5 BLEU | 9.2 chrF into the languages (41.1 against 31.9); mBART-50 also beat ByT5 (37.5) |
| Quechua 23.4 BLEU in domain, 0.2–1.7 out of domain; "domain costs more than any model choice" | The 23.4 system scored 1.4 and 0.6 out of domain; the range mixed systems. The overclaim is withdrawn |
| Mapudungun 34.9–45.8 and 34.9–43.2 in different places | Out of Mapudungun: 34.9–45.8 across sizes (600M: 34.9 → 43.2 with Morfessor). Into Mapudungun: 39.9–42.9, no gain from morphology-aware tokenisation |
| AmericasNLP training sizes 3,900–125,000; every test from the NLI domain | 357 (Chatino) to 125,008; Chatino's test is legal text |
| Kalamang: renewed permission "from the community's consultant" (citing the Gemini report) | From one of the linguist's main consultants, judged by the linguist to reflect the community (Tanzer et al. 2024) |
| Interviewees split 29.4 / 20.6 / 17% on ownership; about 55 / 45 on release | Percentages dropped (22 people; likely shares of responses); the paper's "strong feeling" for public availability, and its privacy, standardisation and learner findings added |
| "The Boasian trilogy is a common name in documentary linguistics" | A product set of the descriptive tradition; documentary linguistics puts recordings first |
| Transcription "10 to 15 hours per hour of audio, about 50 with translation" | "At least" 10 to 15 for a skilled fluent transcriber; 15 to 30 with checking; about 50 with translation |
| Pine et al.: "a few widely respected speakers" were enough "for teaching use" | "Community-engaged" and "the pedagogical value of speech models" restored; labelled an analogy |
| XSTS kappa 0.55 | The mean of 0.43 and 0.67; range 0.12–0.99; professional raters |
| Kocmi et al. thresholds applied to a dev set | System-level, large test sets |
| [INV] interval widths as a safe guide | [INV] widths are too narrow for a real language |
| Klingon under "why it bends on a polysynthetic language"; test-main shown alone | Klingon is agglutinative; test-main shares the training author; test-other shown beside it |
| Agent-judged meaning estimate beside speaker-rated results | Moved to a labelled box |
| Back-translation +1.6 chrF++ (test-main only); worth 2,000–2,500 real pairs | Both test sets, one seed; the linear pair conversion dropped |
| Keep synthetic at or below 1–2 per real pair | Tag it, start at 1:1, tune on dev |
| Hours priced at ten words, outcomes measured at 5.8 | Both lengths shown, in English source words |
| Joanis 20.3 against 35.0 BLEU shows "into" is harder | Partly a BLEU effect |
| Bloodgood 32.9 s per word | MTurk wall-clock including idle time; phrase-level 11.98 s |
| Maillard 200–250 words an hour | Wikipedia domain, agency professionals, word side unstated |
| Maillard "6,000 beat 2 million back-translated" in the bilingual cell | A multilingual setting with pre-existing data |
| Klingon described as unknown to every pretrained model | No open model forge can fine-tune knows it; a closed commercial service lists it |

## E10. What we did not change, and why

| Request | Why not (yet) |
|---|---|
| Re-measure interval widths on Klingon outputs (MT review M4) | Needs a forge run; build list B18. Meanwhile the agent sizes the dev set from the project's own first two runs |
| Re-score in-lexicon accuracy on a fixed subset (MT review M1) | Not yet run; only the in-vocabulary fixed set was. In-lexicon figures are reported as levels at each size, not as change |
| Re-measure memory and time on syllabic text (MT review M10) | Needs a run; build list D20. The figures carry the short-Latin-script caveat |
| Model the two judges' variance inside the interval (MT review B1, M12) | With two fixed judges, between-judge variance cannot be estimated. We use one combined verdict per sentence and report agreement, which understates uncertainty from the choice of judges |
| A full school curriculum unit (linguist review) | A separate deliverable. The playbook keeps the practice-language rule and the rules for student contributions |
| The Rapid Word Collection yield figure (linguist review) | Known only from a secondary source; not cited |
| "Quechua lost performance in a four-language model" (MT review B3, attributed to Chen & Fazio 2021) | Not verified by us; Ortega et al. 2021's measured loss is cited instead |
| "Seed ensembles typically add +1–2 chrF" (MT review) | No source at this data size; the build-list row stays, without the number |
| forge code changes the reviews implied (refuse `run` without the Step-0 record; refuse `registry add` without "cleared for"; reword the R3 message; a custody field; `split --group-by author`; new presets) | This revision is documentation only; each is a build-list row with a priority |
| Rotate the dev set on a schedule (MT review M3) | Partly: grow it at stage boundaries and keep a rarely read dev-confirm split. Full rotation would spend scarce speaker sentences (linguist review M9) |
| A Klingon results column beside the weekly-time table in the community guide (linguist review M7) | Kept to one sentence there ("expect lower") to avoid an implied timeline; the column is in the playbook |
| The reviewers' exact wording for Step 0 and consent | Adapted, not quoted, to fit two printed pages |
| The "ask for endings" arm | Kept as [not yet proven]; now motivated only by the error typing, since the plateau that also motivated it was withdrawn |

## Sources

**Base models, training, hardware**
- NLLB Team (Costa-jussà et al.). 2022. No Language Left Behind. arXiv:2207.04672. https://arxiv.org/abs/2207.04672
- Kudugunta, S. et al. 2023. MADLAD-400. NeurIPS Datasets and Benchmarks. https://arxiv.org/abs/2309.04662
- Xue, L. et al. 2022. ByT5. TACL. https://arxiv.org/abs/2105.13626
- Edman, L. et al. 2024. Are Character-level Translations Worth the Wait? TACL 12. https://aclanthology.org/2024.tacl-1.22/
- Adelani, D. I. et al. 2022. A Few Thousand Translations Go a Long Way! NAACL. https://arxiv.org/abs/2205.02022
- Limbum study. 2026. Embedding Initialization for Unseen Low-resource Languages in Multilingual NMT. https://arxiv.org/abs/2608.07629
- Garcia Gilabert, J. et al. 2024. BSC Submission to the AmericasNLP 2024 Shared Task. https://aclanthology.org/2024.americasnlp-1.17/
- Stackhouse, Debenedetto. 2026. A Systematic Comparison of Parameter-Efficient Fine-Tuning Techniques for Low-Resource NMT. AmericasNLP. https://aclanthology.org/2026.americasnlp-6.4/
- Su, Y. et al. 2024. Unlocking Parameter-Efficient Fine-Tuning for Low-Resource Language Translation. Findings of NAACL. https://arxiv.org/abs/2404.04212
- Singh et al. 2025. Bhili-Hindi-English Parallel Corpus. https://arxiv.org/abs/2511.00486
- Araabi, A., Monz, C. 2020. Optimizing Transformer for Low-Resource NMT. COLING. https://aclanthology.org/2020.coling-main.304/
- Sennrich, R., Zhang, B. 2019. Revisiting Low-Resource Neural Machine Translation. ACL. https://arxiv.org/abs/1905.11901
- Kim, Y., Rush, A. M. 2016. Sequence-Level Knowledge Distillation. EMNLP. https://arxiv.org/abs/1606.07947
- Shazeer, N., Stern, M. 2018. Adafactor. ICML. https://arxiv.org/abs/1804.04235
- Chen, T. et al. 2016. Training Deep Nets with Sublinear Memory Cost. https://arxiv.org/abs/1604.06174
- Feng, D. et al. 2025. Profiling Apple Silicon Performance for ML Training. https://arxiv.org/abs/2501.14925
- Hugging Face Transformers documentation: GPU memory usage; Apple silicon. https://huggingface.co/docs/transformers/model_memory_anatomy
- Creative Commons. CC BY-NC 4.0 Legal Code. https://creativecommons.org/licenses/by-nc/4.0/legalcode.en

**Indigenous and polysynthetic MT**
- Joanis, E. et al. 2020. Nunavut Hansard 3.0. LREC. https://aclanthology.org/2020.lrec-1.312/
- Knowles, R. et al. 2020. NRC Systems for WMT20 Inuktitut-English. https://aclanthology.org/2020.wmt-1.13/
- Roest, C. et al. 2020. English-Inuktitut with Segmentation, Data Acquisition and Pre-Training. WMT. https://aclanthology.org/2020.wmt-1.29/
- Schwartz, L. et al. 2020. Neural Polysynthetic Language Modelling. https://arxiv.org/abs/2005.05477
- Mager, M. et al. 2022. BPE vs. Morphological Segmentation. Findings of ACL. https://aclanthology.org/2022.findings-acl.78/
- Mager, M. et al. 2021. Findings of AmericasNLP 2021. https://aclanthology.org/2021.americasnlp-1.23/
- Ebrahimi, A. et al. 2023. Findings of AmericasNLP 2023. https://aclanthology.org/2023.americasnlp-1.23/
- de Gibert, O. et al. 2025. Findings of AmericasNLP 2025. https://aclanthology.org/2025.americasnlp-1.16/
- Gu, T. et al. 2023. PlayGround Low Resource MT System for AmericasNLP 2023. https://aclanthology.org/2023.americasnlp-1.19/
- Thompson, I. M. et al. 2026. Bringing Mapudungun into the Modern MT Ecosystem. https://aclanthology.org/2026.americasnlp-6.16/
- Chen, W., Fazio, B. 2021. Morphologically-Guided Segmentation. LoResMT. https://aclanthology.org/2021.mtsummit-loresmt.3/
- Zhang, S., Frey, B., Bansal, M. 2020. ChrEn. EMNLP. https://arxiv.org/abs/2010.04791
- Feldman, I., Coto-Solano, R. 2020. Back-Translation for Bribri. COLING. https://aclanthology.org/2020.coling-main.351/
- Ortega, J. E. et al. 2021. Love Thy Neighbor. LoResMT. https://aclanthology.org/2021.mtsummit-loresmt.5/
- Nicolai, G. et al. 2021. Expanding the JHU Bible Corpus. ComputEL-4. https://aclanthology.org/2021.computel-1.1/
- Neubig, G., Hu, J. 2018. Rapid Adaptation of NMT to New Languages. EMNLP. https://arxiv.org/abs/1808.04189
- Teodorescu, D. et al. 2022. Cree Corpus. ACL. https://aclanthology.org/2022.acl-long.440/
- Lane, W., Harrigan, A., Arppe, A. 2022. Interactive Word Completion for Plains Cree. ACL. https://aclanthology.org/2022.acl-long.232/
- Arppe, A. 2025. English phrases and inflected Plains Cree word-forms. AmericasNLP. https://aclanthology.org/2025.americasnlp-1.6/
- Nguyen, T. M. et al. 2025. A hybrid approach for Ojibwe verbs. AmericasNLP. https://aclanthology.org/2025.americasnlp-1.3/
- Chulzhanov, A. et al. 2026. Data Synthesis for Q'eqchi' Mayan. https://arxiv.org/abs/2606.09767
- Ibn Alam, M. M. et al. 2024. Morphologically-Aware Dictionary-based Data Augmentation. https://arxiv.org/abs/2402.01939
- Muradoglu, S., Hulden, M. 2022. How to choose data for morphological inflection. EMNLP. https://aclanthology.org/2022.emnlp-main.492/
- Sylak-Glassman, J. et al. 2016. Remote Elicitation of Inflectional Paradigms. LREC. https://aclanthology.org/L16-1497/

**Data creation and selection**
- Maillard, J. et al. 2023. Small Data, Big Impact. ACL. https://aclanthology.org/2023.acl-long.154/
- Sennrich, R., Haddow, B., Birch, A. 2016. Improving NMT Models with Monolingual Data. ACL. https://aclanthology.org/P16-1009/
- Edunov, S. et al. 2018. Understanding Back-Translation at Scale. EMNLP. https://aclanthology.org/D18-1045/
- Caswell, I. et al. 2019. Tagged Back-Translation. WMT. https://arxiv.org/abs/1906.06442
- Hoang, V. C. D. et al. 2018. Iterative Back-Translation for NMT. https://aclanthology.org/W18-2703/
- Poncelas, A. et al. 2018. Investigating Backtranslation in NMT. https://arxiv.org/abs/1804.06189
- Fadaee, M. et al. 2017. Data Augmentation for Low-Resource NMT. ACL. https://arxiv.org/abs/1705.00440
- Khayrallah, H., Koehn, P. 2018. On the Impact of Various Types of Noise on NMT. https://aclanthology.org/W18-2709/
- Koneru, S. et al. 2022. Cost-Effective Training in Low-Resource NMT. https://arxiv.org/abs/2201.05700
- Chimoto, E. A., Bassett, B. A. 2022. COMET-QE and Active Learning. Findings of EMNLP. https://aclanthology.org/2022.findings-emnlp.348/
- Jones, A. et al. 2023. GATITOS. EMNLP. https://aclanthology.org/2023.emnlp-main.26/
- Bloodgood, M., Callison-Burch, C. 2010. Bucking the Trend. ACL. https://aclanthology.org/P10-1088/
- Meetei, L. S. et al. 2020. English to Manipuri and Mizo Post-Editing Effort. ICON. https://aclanthology.org/2020.icon-main.7/
- Nekoto, W. et al. 2020. Participatory Research for Low-resourced MT. Findings of EMNLP. https://aclanthology.org/2020.findings-emnlp.195/
- Pinhanez, C. et al. 2024. Vitalizing Endangered Indigenous Languages. https://arxiv.org/abs/2407.12620
- Garcia Gilabert et al. 2024 (above).
- PARADISEC. 2010. How long is a piece of string? https://www.paradisec.org.au/blog/2010/04/how-long-is-a-piece-of-string/

**LLM approaches**
- Aycock, S. et al. 2025. Can LLMs Really Learn to Translate a Low-Resource Language from One Grammar Book? ICLR. https://arxiv.org/abs/2409.19151
- Tanzer, G. et al. 2024. A Benchmark for Learning to Translate a New Language from One Grammar Book. ICLR. https://arxiv.org/abs/2309.16575
- Gemini Team. 2024. Gemini 1.5 (MTOB section). https://arxiv.org/abs/2403.05530
- Hus, J., Anastasopoulos, A. 2024. Back to School. EMNLP. https://arxiv.org/abs/2410.15263
- Hus, J., Krasner, B., Anastasopoulos, A. 2025. Grammar Materials for LLM Post-Correction. AmericasNLP. https://aclanthology.org/2025.americasnlp-1.10/
- Iyer, V. et al. 2024. Quality or Quantity? https://arxiv.org/abs/2408.12780
- Gagnier, Kirubakaran. 2026. Culturally Biased LLM Hallucination in Wixarika Translation. AmericasNLP. https://aclanthology.org/2026.americasnlp-6.7/
- Marchisio, K. et al. 2024. How Does Quantization Affect Multilingual LLMs? https://arxiv.org/abs/2407.03211

**Evaluation**
- Popović, M. 2017. chrF++. WMT. https://aclanthology.org/W17-4770/
- Knowles, R., Lo, C. 2022. Expanded Human Evaluation of WMT20 English-Inuktitut. https://aclanthology.org/2022.wmt-1.8/
- Kocmi, T. et al. 2024. Navigating the Metrics Maze. ACL. https://arxiv.org/abs/2401.06760
- Card, D. et al. 2020. With Little Power Comes Great Responsibility. EMNLP. https://arxiv.org/abs/2010.06595
- Wang, J. et al. 2024. AfriMTE and AfriCOMET. NAACL. https://arxiv.org/abs/2311.09828
- Zouhar, V. et al. 2024. Pitfalls and Outlooks in Using COMET. https://arxiv.org/abs/2408.15366
- Bapna, A. et al. 2022. MT for the Next Thousand Languages. https://arxiv.org/abs/2205.03983
- Licht, D. et al. 2022. Consistent Human Evaluation across Language Pairs (XSTS). https://arxiv.org/abs/2205.08533
- Brown, L. D., Cai, T. T., DasGupta, A. 2001. Interval Estimation for a Binomial Proportion. Statistical Science 16(2). https://projecteuclid.org/euclid.ss/1009213286
- Søgaard, A. et al. 2021. We Need to Talk About Random Splits. EACL. https://arxiv.org/abs/2005.00636
- Graham, Y. et al. 2020. Statistical Power and Translationese. EMNLP. https://aclanthology.org/2020.emnlp-main.6/
- Toutou, A. et al. 2026. Data Contamination in Neural Hieroglyphic Translation. https://arxiv.org/abs/2605.07453
- Parra Escartín, C., Arcedillo, M. 2015. Productivity gain thresholds. WPTP4. https://aclanthology.org/2015.mtsummit-wptp.4/
- Pine, A. et al. 2022. Low-Resource Speech Synthesis for Language Revitalization. ACL. https://aclanthology.org/2022.acl-long.507/

**Deployment**
- OpenNMT. CTranslate2 (README benchmarks). https://github.com/OpenNMT/CTranslate2
- Ahia, O. et al. 2021. The Low-Resource Double Bind. Findings of EMNLP. https://arxiv.org/abs/2110.03036
- Zouhar, V. et al. 2021. Backtranslation Feedback Improves User Confidence, Not Quality. NAACL. https://aclanthology.org/2021.naacl-main.14/
- Martindale, M., Carpuat, M. 2018. Fluency Over Adequacy. AMTA. https://aclanthology.org/W18-1803/
- Fomicheva, M. et al. 2020. Unsupervised Quality Estimation for NMT. TACL. https://arxiv.org/abs/2005.10608
- Khoong, E. C. et al. 2019. Google Translate for Emergency Department Discharge Instructions. JAMA Internal Medicine 179(4). https://pmc.ncbi.nlm.nih.gov/articles/PMC6450297
- Taira, B. R. et al. 2021. A Pragmatic Assessment of Google Translate for ED Instructions. J Gen Intern Med 36(11). https://pubmed.ncbi.nlm.nih.gov/33674922/

**Community practice, governance, documentation**
- Carroll, S. R. et al. 2020. The CARE Principles for Indigenous Data Governance. Data Science Journal 19(1):43. https://doi.org/10.5334/dsj-2020-043
- Mager, M., Mager, E., Kann, K., Vu, N. T. 2023. Ethical Considerations for MT of Indigenous Languages. ACL. https://aclanthology.org/2023.acl-long.268/
- Liu, Z. et al. 2022. Not always about you. ACL. https://aclanthology.org/2022.acl-long.272/
- Panel on Research Ethics (Canada). 2022. TCPS 2, Chapter 9: Research Involving the First Nations, Inuit and Métis Peoples of Canada. https://ethics.gc.ca/eng/tcps2-eptc2_2022_chapter9-chapitre9.html
- AILLA (Archive of the Indigenous Languages of Latin America): graded access. https://ailla-legacy.lib.utexas.edu/node/117
- Local Contexts: Traditional Knowledge Labels. https://localcontexts.org
- Himmelmann, N. P. 1998. Documentary and descriptive linguistics. Linguistics 36(1): 161–195.
- Gippert, J., Himmelmann, N. P., Mosel, U. (eds.). 2006. Essentials of Language Documentation. Mouton de Gruyter.
- Matthewson, L. 2004. On the Methodology of Semantic Fieldwork. International Journal of American Linguistics 70(4): 369–415.
- Bloomfield, L. 1930. Sacred Stories of the Sweet Grass Cree. National Museum of Canada Bulletin 60.

**Klingon data**
- Tatoeba: terms of use and downloads (CC BY 2.0 FR; direct links only in exports). https://tatoeba.org/en/terms-of-use ; https://tatoeba.org/en/downloads
- OPUS (Tatoeba English–Klingon counts). https://opus.nlpl.eu/
- Okrand, M. (trans.). 2022. paq'batlh: The Klingon Epic, 2nd ed. punctum books. CC BY-NC-SA 4.0. https://zenodo.org/records/19849412
- Microsoft Translator's Klingon listing: from a third-party language list; not verified against Microsoft's own pages.

**forge's own measurements**
- [KL] forge's ByT5-small learning curve, analyses, decoding and back-translation tests, and MADLAD-400 probe on Klingon (Tatoeba), 2026-10-13 to 2026-10-14, including the fixed-set re-analysis of 309 sentences.
- [INV] forge's runs on its invented test language, 2026-10-11 to 2026-10-14.
