# Agent playbook: building a deployable translator for the hardest pair

*Draft, 2026-10-14, revised after two adversarial reviews (a field linguist's
and an MT researcher's). For the AI agent that runs forge with a language
team. The people read the [community guide](BUILDING_A_DEPLOYABLE_TRANSLATOR.md);
the numbers and sources are in the
[evidence appendix](EVIDENCE_DEPLOYABLE_TRANSLATOR.md), which also lists what
we chose not to change and why. Every claim is in
[`BUILDING_A_DEPLOYABLE_TRANSLATOR.claims.json`](BUILDING_A_DEPLOYABLE_TRANSLATOR.claims.json).*

## 0. Standing rules for the agent

1. **Quote the community guide; never paraphrase its cautions.**
2. **Record and remind; never decide.** Decisions belong to *the authority*
   (the body that can say yes for the language community) and *the language
   team*. Use those two terms, not "the people".
3. **Never fetch language text from the web or an archive on your own.** Never
   take in an item that the inventory has not marked "cleared for training".
4. **Never plan speaker work without hours and money** at the rate the
   community sets.
5. **Never let a general-purpose LLM write the language** at community data
   sizes (evidence appendix §E4).
6. **When language-team members disagree** (families, dialect groups,
   generations): stop, record both views, refer the question to the authority.
   Never pick the majority.
7. **Say early and plainly when the team's time cannot reach its bar.**
8. **Use the markers:** [KL] measured with forge on Klingon (Tatoeba); [INV]
   measured with forge on its invented test language; [derived] our arithmetic;
   [not yet proven]; [policy]. **Never place an agent-judged estimate beside a
   speaker-rated result.**

## 1. Preconditions: nothing is trained until all five exist

| # | Precondition | What the agent records | forge today |
|---|---|---|---|
| P1 | **Who may say yes** (Step 0 of the community guide) | The authority, its written decision, who on the team may decide what; ethics approval (university; in Canada TCPS 2 chapter 9); board approval and guardians' consent (school) | Not enforced; build list A1 |
| P2 | **Inventory** with rights layers and "cleared for" on every item | One row per item (fields in the community guide, Step 2); consent in two layers (speaker or family; the authority), what each covered, and its date | Per-file terms exist; "cleared for" not enforced; A2, A3 |
| P3 | **Custody plan** | Master-copy holder, community-controlled encrypted backups, successor custodian, copies returned to speakers and to the community's archive | Missing; A4 |
| P4 | **Speaker-care plan** | Hours and money per person (elder and scribe both counted), session length, protocol, the right to skip | Time only (`champollion improve time`); A5 |
| P5 | **Dialect, spelling and ownership decisions** by the authority | Which dialects and orthographies; one model per dialect, a dialect tag, or train in one orthography and convert mechanically (only with approval); who owns any model; release yes or no | Missing; A1, F3 |

## 2. Scope, character, range, direction

**Scope: is a translator the right tool?** Offer the cheaper tools first
(community guide, Step 1): a conjugator built on an analyser, a talking
dictionary, a reviewed phrasebook. Ask who will read the output, whether they
can tell when it is wrong, and who checks it first.

- **Learners:** no unreviewed machine output is ever shown. Use a bank of
  reviewed outputs.
- **Health information:** not a scope for this translator. Human translation and
  a qualified interpreter; the model at most as a terminology aid.
- **Domain:** a model trained on narrow text can collapse on other text (a
  Quechua system went from 23.4 BLEU in domain to 1.4 and 0.6 out of domain).
  Draw dev and test sentences from the chosen scope.

**Character.** Ask about register as the language marks it: respect and
kin-based speech styles, speech that differs by gender where it exists, older
and newer speech. Dialect and spelling are the authority's decisions (P5), not
a normalisation setting. Keep raw text beside any normalised copy, always.

**Range.** Build the range list from the grammar's categories that English
does not mark, because that is where translation into the language must
supply information English never gave. Depending on the language these may
include obviation, animacy, inclusive versus exclusive "we", direct versus
inverse, independent versus conjunct verb forms, evidentials, and noun
incorporation. For each category, collect sentences that force each value, and
give dev and test sentences a second reference wherever English leaves the
choice open.

**Direction.** forge trains one direction per model. Into the language is the
harder and higher-risk direction. The reading direction (the language into
English) can expose discussions a community keeps private by speaking its own
language; build it only with the authority's explicit agreement.

## 3. Inputs: what each contributes and the rules for each

| Input | Contributes | Rules |
|---|---|---|
| **Recordings** (the fourth leg documentary linguistics puts first) | Meaning-first data | Interim lane: respeaking plus a spoken translation recorded on a phone; an elder-and-scribe pair writes only the segments chosen for training. forge needs text (build list C11) |
| **Interlinear texts** (language line, morpheme gloss, the linguist's free translation) | Pairs, after work | Re-align by sentence; have a speaker check the free translation (it is the linguist's English, often loose and old-fashioned); convert old orthography with the original kept beside it (C12) |
| **Translated texts and example sentences** | Training pairs | Only items cleared in the inventory. Classic collections often hold sacred narratives: unclassified means excluded |
| **Pairs reached through a third language** (the language translated from French, say, and English from the same French) | A legitimate, noisier source | Own labelled lane; never in dev or test. On Tatoeba, about a fifth of Klingon sentences that reach English do so only this way (§E1) |
| **Text only in the language** | Back-translation; continued pretraining | Only after a usable reverse model exists; in-scope text only (§5, Stage 2) |
| **Dictionaries** | Range list, dictionary floor (`nmt-forge floor`), unseen-word flags | Record each dictionary's date, dialect, orthography and rights. Never merge dictionaries (a missionary-era one with a modern learner's one, say) without a speaker's review |
| **Grammar** | Range categories, paradigm tables, error reading | Prose cannot train an NMT model; its example sentences can, once cleared |
| **FST** (word analyser and generator) | Flags for a speaker to check; error typing; generated forms for speakers to check; learner tools | **A rejected word is not a wrong word**: an FST rejects missing stems, other dialects, loanwords, names, new coinages and other spellings. Before using it, measure how much of the community's own cleared text it accepts. Never use it as a hard gate on words a speaker provided (forge's validity floor applies only to generated rows). Record its makers, variety, orthography and licence in the inventory |
| **Related languages and dialects** | Often the largest lever after in-scope pairs | Tagged lane per language; dev and test on the target only; consent and terms per lane; keep it only if dev improves, because unrelated data can hurt (§E3) |

## 4. The yardstick: dev, test and speaker judgement

**Staged, so the community sees benefit early.**

1. Start with a **dev set of about 100 sentences**: freshly written, or drawn
   from cleared texts the community holds, single-translated. Grow it to 200
   or more with `nmt-forge grow-dev`. Split it into **dev-compare** (read every
   round) and **dev-confirm** (read only at stage boundaries).
2. Write the **test set from new, never-published sentences** (anything public
   may already be inside a base model's pretraining crawl). Make it
   author-disjoint: no test sentence from a speaker or writer whose sentences
   are in training (build list B2). Register it local-only and preregister
   predictions before any score.
3. Add **second references** for the range's ambiguity set first. Record a
   dialect disagreement between translators as a second reference, not as an
   error.
4. **Cost the judging** in hours and money. Record when a judge also wrote the
   references.
5. **Interval width:** compute the 95% interval on a dev difference from the
   project's own first two runs, and size the dev set from that. forge's
   published widths come from its invented language [INV], whose near-perfect
   outputs make intervals narrower than a real language's.

**The round verdict (keep the new model only if all hold):**

1. The paired-bootstrap 95% interval on the dev-compare chrF++ difference
   excludes zero.
2. Below about 5,000 pairs, the difference is also larger than the seed band:
   the spread of **three seeds** of the model in use.
3. Exactly-right (and in-lexicon accuracy, where an analyser exists) on fixed
   dev subsets does not fall by more than its own paired interval.
4. If chrF++ and exactly-right disagree, the speaker's review sheet decides.
5. Several arms at once (words, endings, random, two bases): name one primary
   comparison in the preregistration and Holm-correct the rest.
6. Small levers (+0.3 to +3 points) can be confirmed only by pooling seeds or
   by a larger dev set. Otherwise report "no measurable change".
7. Never use MBR decoding with chrF as its utility by default: it optimises
   the yardstick. On Klingon it raised chrF++ by 1.6 while exactly-right fell
   from 23.2% to 22.8% [KL].

**Speaker judgement at milestones:**

1. Freeze the question first [policy]: right/wrong for meaning, or a 1 to 5
   scale with its cut point named.
2. Freeze how two judges combine: **right only if both say right**. Report each
   judge's own rate, the disagreements, and Cohen's kappa with its interval.
3. Sentences: fresh, in scope, never used in training or in choosing a model.
   Blind and shuffled, with a few human translations mixed in as anchors.
4. **The bar is on the lower edge** of the Wilson 95% interval, not the point
   estimate [policy].
5. **Size for 80% power** [derived, exact binomial; the method is in §E6]:

| If the true share right is | and the bar (lower edge) is | sentences needed for 80% power |
|---|---|---|
| 90% | 80% ("working") | about 100 to 110 |
| 85% | 80% | about 450 to 480 |
| 65% | 50% ("useful draft") | about 80 to 90 |
| 60% | 50% | about 190 to 200 |

With 100 sentences, "working" is confirmed only if **88 or more** are judged
right; "useful draft" only if 60 or more are. Plain reading for the team: "80
of 100 right means the true rate is probably between about 7 and 9 in 10."

## 5. Stage by stage

Klingon columns are an easier case: a constructed, agglutinative language (not
polysynthetic), Latin script, short sentences averaging 5.8 English words.
**test-main is written by the same author as the training data; test-other by
other authors.** Hours are at a professional pace, 24 to 30 per 1,000
six-word pairs or 40 to 50 per 1,000 ten-word pairs, for one person; double
them when an elder dictates to a scribe [derived].

| Stage | Pairs | Klingon chrF++ (test-main / test-other) [KL] | Klingon exactly right, test-main [KL] | Speaker hours to reach it (6-word / 10-word) |
|---|---|---|---|---|
| Setup | 0 | | | dev 100 + test 200 written: about 7 to 15 |
| 1 | to about 2,000 | 1,600: 21.6 to 26.8 / 20.1 to 24.8 | 0.8 to 2.3% | 38 to 48 / 64 to 80 (at 1,600) |
| 2 | 2,000 to about 6,000 | 3,200: 40.2 / 37.4; 6,400: 52.6 to 53.3 / 48.2 to 49.0 | 9.5%; 18.7 to 19.6% | 154 to 192 / 256 to 320 (at 6,400) |
| 3 | 6,000 to about 20,000 | 12,800: 56.5 to 56.6 / 52.4 | 23.2 to 23.7% (test-other about 25%, one run) | 307 to 384 / 512 to 640 (at 12,800) |
| "Working" | unknown | | | unknown |

### Stage 0: setup (no pairs)

1. Preconditions P1 to P5 (§1).
2. `nmt-forge discover <language code>`: what the language card says exists
   (absence means unknown).
3. Ask what parallel data exists for **related languages and dialects**, and
   whether pairs reached through a third language exist.
4. Build the yardstick (§4).
5. **Tokenizer and script audit** by hand until forge has it (B13): unknown
   pieces and pieces per word for each candidate base; for ByT5, bytes per
   sentence against forge's 320-byte limit (about 106 syllabic characters).
6. **Zero-shot probe** of any base that lists the language: translate the dev
   set untrained; read chrF++ and the share of outputs that copy the English.
   A listing is a rumour: MADLAD-400 lists Klingon and scored chrF++ 8.6, 0
   of 1,000 exactly right, with 33% of outputs the English copied back [KL].
7. `nmt-forge floor`: the dictionary floor any model must beat.
8. Show each candidate base's licence to the team.
9. **Give something back now:** a cleaned digital word list, a digitised
   cleared text set. Fluent speakers' availability falls over time, so
   recording them and building the dictionary may matter more than any model.

### Stage 1: zero to about 2,000 pairs

- **Ask for, in this order:** cleared in-scope texts; then the range, mixing
  methods: sentences speakers write or say first (then translated into
  English); picture or situation prompts; English prompts drafted *with* the
  team. Any prompt may be skipped. Log the elicitation method on every pair.
  Short sentences first: Klingon sentences of 1 to 4 English words were 4 to
  5 times as often exactly right as those of 8 or more [KL].
- **Train:** forge's default for the hardware (§6).
- **Measure each round:** the verdict in §4; unseen-word rate on the team's
  wanted sentences (`nmt-forge analyze`); copy-through and near-constant output
  (forge relays these from its scorer); hours and money spent.
- **First review** at 1,000 to 2,000 pairs: a speaker marks about 30 drafts
  and fixes the wrong ones (`champollion improve sheet`, `marks`).
- **Expect:** a phrase helper. Say so.

### Stage 2: about 2,000 to 6,000 pairs

- **Base comparison, three ways,** at or near the data size the team expects to
  reach, re-run at every stage boundary, three seeds each:
  1. **ByT5-small** (Apache-2.0): first choice for unusual scripts and heavy
     spelling variation, because bytes have no unknown pieces;
  2. **M2M-100 418M** (a pretrained translation model) **or mBART-50**
     (both MIT): in the closest published study, M2M-100 beat ByT5 by 9.2
     chrF on average into 16 African languages, half of them absent from
     M2M-100's pretraining;
  3. **NLLB-600M, full fine-tuning** (CC BY-NC 4.0): only where the licence
     fits the planned use, and only with full fine-tuning (forge needs an
     `nllb-600m-full` preset, build list D4, or a rented GPU). **Never rank forge's
     LoRA rank-16 NLLB preset against a fully fine-tuned ByT5.**
- **LoRA against full fine-tuning: measure, do not assume.** Where memory
  allows both, run both on the same dev set.
- **Related-language lanes** (§3), kept only if dev improves.
- **Back-translation** of cleared in-scope text once a reverse model is usable.
  Tag it; start at 1 synthetic per real pair and tune the ratio on dev. On
  Klingon (one run, one seed) 10,196 back-translated sentences gave +1.6
  chrF++ and +1.7 points exactly right on test-main, +0.9 and +1.1 on
  test-other [KL].
- **Ask for endings** as one arm beside a words arm and a random arm, compared
  at equal speaker hours [not yet proven]. Have speakers **check** forms the
  FST generates in natural carrier sentences (yes / no / fix) rather than
  produce every paradigm cell. The motivation is forge's error typing on
  Klingon: 43 to 44% of one-word misses were a known stem with a wrong ending
  (heuristic word splitter, checked by an agent, not a speaker) [KL].
- **Measure:** in-vocabulary and in-lexicon accuracy **on fixed subsets** (the
  same sentences at every size); error types, checked by a speaker on a sample.
- **Milestone:** the first blind speaker sample (§4).

### Stage 3: about 6,000 to 20,000 pairs

- **More random pairs still help, slowly.** On one fixed set of 309 Klingon
  sentences, exactly right rose from 37.5 to 38.2% (6,400 pairs) to 42.4 to
  42.7% (12,800), and to 43.4% with back-translation [KL]. Keep a random arm;
  add targeted arms.
- **Error-driven selection:** sentences and forms the current model gets wrong.
  In translation into English, a quality-estimate selection beat random by 0.3
  to 2.0 BLEU, and round-trip-likelihood selection did worse than random (§E3). Not before
  the model is usable.
- **Post-editing** only where a 20-sentence time trial shows it is faster for
  that speaker.
- **Stronger bases** on a rented GPU if needed (semi-sovereign; §6).
- **Small-data tuning grid** at stage boundaries (dropout, depth, label
  smoothing, learning rate; subword vocabulary size for subword bases), seeds
  held fixed.
- **Ensembles and checkpoint averaging** of the seeds already trained.
- **Choose better among candidates** [not yet proven]: on Klingon at 12,800
  pairs the right answer was among the 8 best candidates for 38.9% of
  sentences but chosen for 23.2% [KL]. A word-list gate made it worse; a
  reverse-model chooser added 0.3 points. An FST reranker that only flags for
  a speaker is the experiment; measure the oracle first.

### Stage 4: deploy

1. Choose on dev; read the test set once, with predictions written first
   (`nmt-forge export --prereg …`).
2. Blind speaker sample at the bar's lower edge (§4); report the tier in plain
   words.
3. **CPU speed** against forge's deployable target (95% of sentences within
   1.5 s on a laptop CPU, under 2 GB) [policy]. ByT5 translates about 5 to 6
   times slower than a subword model. **If it misses, distil:** translate
   in-scope English with the strongest affordable teacher (a rented larger
   model, or the seed ensemble), train a small subword student on the teacher's
   outputs plus the real pairs, and re-judge the student on the same speaker
   sample.
4. **Compression** (8-bit weights, pruning): re-judge on the same speaker
   sample; automatic scores understate the damage.
5. **Label all released output as machine-made.** Name unseen input words (`serve` does).
   Fallback to a phrasebook or a person; keep the previous model
   (`nmt-forge choose`).
6. **Approved terms:** constrained decoding for terms the community approved,
   allowing their inflected forms (build list E7).

### Harms and misuse: mitigations the agent puts in place

| Harm | Mitigation |
|---|---|
| The reading direction exposes community discussions | Built only with the authority's agreement; never run on others' private text |
| Unlabelled machine output posted online is scraped back as real language | Every released output labelled machine-made; nothing unreviewed posted |
| A "good enough" model replaces paid translators or interpreters | The tier stated beside the tool; health excluded |
| An outside party fine-tunes a released model | Release is the authority's decision, with a licence; the default is not released |
| Model output presented as the community's voice | Labelling; the authority approves any public use |

### Ending a project

Exit criteria agreed with the authority. Retiring a model: stop serving,
delete copies as the authority directs, return data and records to the
custodian. On **withdrawal of consent**, retrain without those files (each
run records its source files) and delete earlier copies.

### Schools

Students learn the procedures on a **practice language first** (forge's
invented test language, or a class-made mini-language) before touching
anything of the community's. Student work enters only with guardians' consent,
a fluent speaker's review, and never in dev or test.

## 6. Hardware and remote compute

| Base | Training state, AdamW / Adafactor [derived] | Measured with forge |
|---|---|---|
| ByT5-small (300M, Apache-2.0) | 4.8 / 2.4 GB | About 16 GB of a 24 GB Mac's GPU memory; out of memory at a 12 GB cap [KL] |
| M2M-100 418M (MIT) | 6.7 / 3.3 GB | Not run |
| NLLB-200 600M (CC BY-NC 4.0) | 9.8 / 4.9 GB | Full fine-tuning ran out at forge's earlier 16 GB cap at batch 8 [KL] |
| NLLB-200 1.3B | 20.8 / 10.4 GB | LoRA ran out at the 16 GB cap [KL] |
| MADLAD-400 3B (Apache-2.0) | about 47 / 24 GB | Zero-shot probe only |

- forge fits a run to a Mac's memory (about 20 GB of 24, 12 of 16, 5.3 of 8),
  steps down on out-of-memory, and refuses with advice when nothing fits.
- **The Klingon memory and time figures come from short, Latin-script, nearly
  ASCII sentences.** A byte-level model's memory and time grow with byte
  length; syllabic text costs 3 bytes a character. Re-measure on the team's
  own text.
- **Rented GPU, semi-sovereign:** forge sends nothing without a typed yes per
  exact file, never sends a test set, uses RunPod's Secure Cloud in agreed
  countries, needs a spending cap, wipes and shuts the machine down, and
  records file hashes only. **A datacentre's location does not settle which
  country's laws apply to the provider.**

## 7. The build list: what forge has, and what it must add

**P0** is a precondition for the first training run. **1** blocks trust in the
numbers or the progress; **2** a likely gain; **3** later or narrow.

| # | Requirement or technique | forge today | Evidence or reason | Priority |
|---|---|---|---|---|
| **A. Before any training** | | | | |
| A1 | Step-0 record (authority, approvals, decision rights); first `run` refused without it | Missing; the agent records it by hand | Linguist review; TCPS 2 chapter 9 | P0 |
| A2 | Inventory with rights layers; `registry add` refused without "cleared for" | Missing | Published is not permitted | P0 |
| A3 | Two-layer consent (speaker or family; authority) with scope and date | Partial: per-file terms beside each file | Documentation consent does not cover machine learning | P0 |
| A4 | Custody: custodian on every record, backups, successor | Missing | Data leaves with departing people | 1 |
| A5 | Speaker-care plan: hours and money, elder and scribe both counted | Partial: time only | Liu et al. 2022; Pine et al. 2022 | P0 |
| A6 | The agent never fetches language text; unclassified items excluded | Agent rule only | Sacred material sits in published collections | P0 |
| **B. Measuring honestly** | | | | |
| B1 | Group-disjoint split; leak audit; near-twin removal | **Exists:** `split`, `verify-split`, `leak-audit --clean-to … --drop-test-twins` | 30% of Klingon test rows had a near-twin [KL] | done |
| B2 | Author- or speaker-disjoint split (`split --group-by author`) | Missing | Klingon test-main shares its author with training | 1 |
| B3 | Contamination check: no test text that is published anywhere; n-gram overlap against corpora a base is known to include | Missing | Pretraining crawls may hold public texts | 1 |
| B4 | Dev fence, plus a rarely read dev-confirm split and scheduled growth | Partial: dev fence; `grow-dev` | Dozens of keep/discard calls overfit one dev set | 1 |
| B5 | Preregistration; ledger of test reads | **Exists:** `prereg`, `ledger show` | | done |
| B6 | Two-part round verdict (chrF++ interval plus no drop in exactly-right or in-lexicon) | Partial: `compare-runs` gives the chrF++ verdict | chrF did not track human adequacy in AmericasNLP 2021 | 1 |
| B7 | Seed band: three seeds below about 5,000 pairs, and the verdict must beat it | Missing (taxonomy GAP-5) | One seed moved Klingon about 5 chrF++ at 1,600 pairs [KL] | 1 |
| B8 | Holm correction or one preregistered primary arm | Missing | Multiple comparisons | 2 |
| B9 | In-vocabulary and in-lexicon accuracy on fixed subsets | Missing (trial scripts only) | The earlier plateau reading compared different subsets | 1 |
| B10 | Error typing with the FST, speaker-checked on a sample | Missing | [KL] split from a heuristic splitter | 1 |
| B11 | Copy-through, near-constant and length caveats beside scores | **Exists** (lint rule R9) | | done |
| B12 | Zero-shot probe command | Partial: by hand | MADLAD on Klingon [KL] | 1 |
| B13 | Tokenizer and script audit; FST acceptance on cleared text | Missing (taxonomy GAP-1) | Syllabics cost 3 bytes a character | 1 |
| B14 | Speaker verdict, newer model against model in use | **Exists:** `draft-newer`, `speaker-verdict`; `champollion improve sheet`, `marks` | | done |
| B15 | Frozen question; two-judge rule (both right); kappa with interval; 80%-power sizes; bar on the lower edge | Partial: single-judge marks with a Wilson interval | MT review B1 and M12 | 1 |
| B16 | Second references for the ambiguity set | Missing | Range categories English leaves unmarked | 1 |
| B17 | Neural metrics labelled "not validated for this language" | Partial: `discover` shows metric trust by family | | 2 |
| B18 | Interval widths re-measured on a real language (Klingon) | Missing | [INV] widths are too narrow for this use | 2 |
| **C. Collecting data** | | | | |
| C1 | Time and money asked and recorded | Partial: time (`champollion improve time`) | | 1 |
| C2 | Seconds per word measured in session one, for both people in an elder-and-scribe pair | Missing | Published rates are borrowed | 1 |
| C3 | Wishlist of unseen words, weak sentence kinds, open prompts | **Exists:** `wishlist`, `analyze` | | done |
| C4 | Range list from the grammar's unmarked categories; coverage shown | Partial: the coverage-map guard (a library call); `analyze` | | 1 |
| C5 | Endings arm; speakers check generated forms in carrier sentences | Missing; a Klingon endings-against-words test is running | [not yet proven] | 1 |
| C6 | Error-driven selection | Missing | Chimoto & Bassett 2022 | 2 |
| C7 | A random arm in every batch; arms compared at equal speaker hours | Partial: at least a quarter open prompts | | 2 |
| C8 | Variation metadata on every pair: speaker (pseudonymous), dialect, generation, orthography, date, elicitation method, contributor type | Missing | Without it, no "[not yet proven]" question can be answered | 1 |
| C9 | Student contributions: guardians' consent, fluent review gate, never in dev or test | Missing | Schools are a named audience | 1 |
| C10 | Orthography lint message: "more than one convention found; confirm this was intended"; raw kept beside normalised | Partial: convention lint and rule R3 flag "mixed conventions" | Spelling is often political | 2 |
| C11 | Oral-first lane: respeaking, spoken translation, chosen segments written | Missing | Transcription costs at least 10 to 15 hours per hour of audio | 2 |
| C12 | Interlinear-text intake (sentence re-alignment, speaker check, orthography conversion) | Missing | | 2 |
| C13 | Post-editing with a time trial | Partial: review fixes enter training | | 2 |
| C14 | Third-language (indirect) pairs as their own labelled lane | Missing | About 21% of Tatoeba's Klingon-English reach is indirect (§E1) | 3 |
| C15 | **Related-language and dialect lanes**: per-language tags, target-only dev, terms per lane | Missing | Maillard et al. 2023; AmericasNLP winners (§E3) | 1 |
| C16 | English-side prompt drafting with a *local* LLM (no language text leaves) | Missing | MT review missing-techniques list | 3 |
| **D. Training** | | | | |
| D1 | Presets `cpu-tiny`, `cpu-finetune`, `nllb-600m` (LoRA), `byt5-small`, `byt5-small-lowmem` | **Exists:** `init --model`, `use-model` | | done |
| D2 | Fit the run to memory | **Exists** | | done |
| D3 | Measure `byt5-small-lowmem` on 8 to 16 GB computers | Missing (unmeasured) | Common school laptops | 1 |
| D4 | `nllb-600m-full` preset (Adafactor plus recomputed activations) | Missing | The fair NLLB comparison | 1 |
| D5 | `m2m100-418m` and `mbart50` presets | Missing | +9.2 chrF over ByT5 into unseen languages (Adelani et al. 2022) | 1 |
| D6 | Three-way base comparison command, three seeds, at stage boundaries | Partial: running on Klingon by script | | 1 |
| D7 | LoRA and full fine-tuning measured side by side | Missing | Mixed published evidence (§E4) | 2 |
| D8 | NLLB new-language tag, embedding initialisation, vocabulary extension | Partial: an existing tag is borrowed | Limbum study 2026 | 2 |
| D9 | Back-translation command: tagged, ratio tuned on dev from 1:1, quality gate; later iterative back-translation | Partial: library step and tagged lane; no gate (GAP-4) | | 2 |
| D10 | FST-verified synthetic data as a capped minority; ratio check before training | Partial: `synth`, `mix.validator`, `sample`; no ratio check (GAP-3) | | 2 |
| D11 | Small-data tuning grid at stage boundaries | Missing | Araabi & Monz 2020 | 2 |
| D12 | Checkpoint averaging and seed ensembles | Missing | +1.69 chrF++ from averaging (Gu et al. 2023) | 2 |
| D13 | Morphology-aware segmentation arms (subword bases only) | Missing | Gains out of the language, not into it (§E3) | 3 |
| D14 | Continued pretraining on text in the language | Missing | Small gains for ByT5 (Adelani et al. 2022) | 3 |
| D15 | Staged fine-tuning, general to in-scope | Missing | | 3 |
| D16 | Pause training while a person uses the computer | Missing (trial scripts only) | 1.1 to 1.5 hours of pauses per overnight job [KL] | 2 |
| D17 | Capacity check (a quarter, half and all of the data) | Missing | | 2 |
| D18 | Remote: rented GPU, semi-sovereign | **Exists:** `remote doctor`, `plan`, `consent`, `status`; `run --remote runpod --max-cost` | | done |
| D19 | Remote runs that keep the dev set on the community's computer | Missing | | 2 |
| D20 | Memory and time re-measured on syllabic and long text | Missing | Byte length drives cost | 2 |
| **E. Decoding and deployment** | | | | |
| E1 | Greedy or beam, set in the config; no MBR-with-chrF default | **Exists** (decoding); the MBR rule is advice | | done |
| E2 | FST reranker experiment that flags, never gates | Missing [not yet proven] | 38.9% against 23.2% [KL] | 2 |
| E3 | Offline export and serve with unseen-word flags and a fallback | **Exists:** `export`, `serve`, `choose` | | done |
| E4 | Laptop-CPU speed and memory check against the deployable target | Missing | | 1 |
| E5 | Sequence-level distillation to a CPU student | Missing | Kim & Rush 2016 | 2 (1 if E4 fails) |
| E6 | Compressed build re-judged on the same speaker sample | Missing | | 2 |
| E7 | Constrained decoding for approved terms, inflection allowed | Missing | Terms bar | 2 |
| E8 | Machine-made label on released output; reviewed-bank mode for learners | Missing | Linguist review M8 | 1 |
| E9 | Uncertainty flag calibrated on the speaker sample | Partial: unseen-word flag | | 3 |
| **F. Governance** | | | | |
| F1 | Private text withheld from anything an agent reads | **Exists** | | done |
| F2 | Typed consent per file before remote compute; test sets never leave | **Exists** | | done |
| F3 | Ownership, use and release decision recorded with each model | Missing (`choose` records only the model in use) | | P0 |
| F4 | Base licence shown before a base is chosen | Missing | NLLB is non-commercial | 1 |
| F5 | Withdrawal: retrain without the files, delete copies | Partial: each run's identity records its training files | | 1 |
| F6 | Project end: retire a model, return data and records | Missing | | 2 |
