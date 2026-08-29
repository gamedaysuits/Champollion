---
sidebar_position: 5
title: "Espesipikasyon ng Pagmamarka"
slug: '/network/specifications/scoring'
related:
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "When a score difference actually means something"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
    note: "The tool that computes these metrics"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "These scores, live"
---

# Espesipikasyon ng Pagmamarka

> **Buod ng Tagapagpaganap.** Ito po ang nag-iisang pinagmumulan ng katotohanan (single source of truth) para sa lahat ng evaluation metrics, composite scoring, quality tiers, at cost analysis sa Champollion MT evaluation ecosystem. Ang mga language-specific evaluation metrics — FST morphological validity, linter equivalence classes, at deterministic semantic validation — ay sama-samang tinatawag na **LYSS** (Linguistically-informed Yield & Structural Scoring). Bawat metric na kinakalkula ng harness, bawat weight sa composite formula, at bawat tier threshold ay tinutukoy rito — at tanging rito lamang po. Ang code, documentation, at database schemas ay nagmumula po sa dokumentong ito. Kapag mayroon pong salungatan, ang dokumentong ito ang may awtoridad.
>
> **Saklaw.** Tinutukoy po ng dokumentong ito kung *ano* ang aming sinusukat at *paano namin ito binibigyan ng marka*. Hindi po nito tinutukoy ang run card schema (tingnan ang BENCHMARK_SPEC §3), ang benchmark protocol (BENCHMARK_SPEC §6), o ang mga panuntunan ng leaderboard (tingnan ang arena docs). Ang mga dokumentong iyon ay sumasangguni rito para sa mga metric definition at scoring logic.


---

## 1. Pilosopiya ng Pagmamarka

### 1.1 Pilosopiya ng Microeval

> *"Kung magtutuon lamang tayo sa kung ano ang nag-ge-generalize, tiyak na malilimutan natin ang mga lugar kung saan hindi ito umaangkop — at mawawala sa atin ang mga wikang ito at ang lahat ng kanilang kaalaman at karunungan."*

Isinasagawa ng proyektong ito ang **microeval development**: pagbuo ng evaluation metrics na iniangkop sa partikular na mga wika gamit ang pinakamahuhusay na linguistic tools na available — finite-state transducers, bilingual dictionaries, morphological analyzers, linguist-curated equivalence rules. Kabaligtaran ito ng nangingibabaw na paradigma sa MT evaluation, na naghahanap ng universal metrics na gumagana sa lahat ng wika. Mahalaga ang universal metrics, ngunit pinakamahina ang mga ito mismong kung saan sila pinakakailangan: para sa mga wikang may kumplikadong morphology, limitadong training data, at walang representasyon sa neural metric training sets.

Hindi tayo umuunlad sa machine translation para sa marami sa mga wika sa mundo hindi lamang dahil kulang tayo sa corpora, kundi dahil **hindi nga natin alam kung ano ang itsura ng progreso** — kulang tayo sa automated evaluation tools upang masukat kung bumubuti ba ang isang translation system. Ang LYSS ang aming pagtatangkang buuin ang mga tool na iyon, wika bawat wika, gamit ang anumang linguistic resources na mayroon.

### 1.2 Ang Automated Metrics ay Mga Proxy

Bawat metric na tinutukoy dito ay machine-computed. Kapaki-pakinabang ang mga ito para sa mabilis na iteration, sistematikong paghahambing, at pagtukoy ng regressions. **Hindi sila kapalit ng human judgment**. Ang quality tiers sa §5 ay heuristic labels — tanging human review lamang ang makapagkukumpirma ng aktuwal na usability.

### 1.3 Multi-Signal Design

Walang iisang metric ang nakasasaklaw sa kalidad ng pagsasalin. Maaaring may perpektong chrF++ overlap ang isang translation ngunit pumalya sa morphological validation. Maaari itong pumasa sa FST checks ngunit magdala ng maling kahulugan. Maaari itong maging semantically accurate ngunit stylistically alien sa target language. Pinagsasama ng composite score sa §4 ang maraming independent signals, na bawat isa ay kumukuha ng ibang dimensyon ng kalidad.

### 1.4 Extensibility

Hindi sarado ang metric inventory na ito. Nagdadala ang mga bagong wika ng mga bagong requirement: tone accuracy para sa tonal languages, diacritical precision para sa Semitic scripts, syllabary correctness para sa Cree. Ang architecture (MetricPlugin protocol, weighted composite with re-normalization) ay dinisenyo upang maidagdag ang metrics nang hindi sinisira ang umiiral na scores. Ang language-specific metrics (hal., CRK's linter and semantic validator) ay idinedeklara sa language cards sa ilalim ng `evalMetrics` at nilo-load mula sa `eval_standards/` — ang harness ay may kasamang generic behavioral metrics lamang (code-switching, hallucination, terminology).

### 1.5 Tatlong Dimensyon ng Evaluation

Bawat run card ay sumusukat ng tatlong independent dimensions:

```
Quality   — How good is the translation?   (composite score, §4)
Cost      — How much does it cost?          (cost metrics, §6)
Speed     — How fast does it run?           (speed metrics, §7)
```

Independent axes ang mga ito. Maaaring mataas ang kalidad ng isang method ngunit mahal, mabilis ngunit hindi tumpak, o anumang kombinasyon. Pinahihintulutan ng leaderboard ang sorting ayon sa anumang dimension. Ang cost-adjusted score (§6.3) ang tanging metric na nagsasama ng dimensions.

### 1.6 Validation Status

Bawat metric sa espesipikasyong ito ay may **validation status** na hiwalay sa implementation status nito (§3). Sinusubaybayan ng implementation status kung umiiral ang code. Sinusubaybayan ng validation status kung naipakita na bang may correlation ang metric sa human quality judgments.

| Validation Level | Kahulugan | Kasalukuyang Metrics |
|------------------|-----------|----------------------|
| **✅ Externally validated** | May mga published human-correlation studies (WMT, academic papers) | `chrf_plus_plus`, `bleu`, `comet_score` *(high-resource pairs lamang)* |
| **⚡ Proxy-validated** | Validated para sa high-resource languages; unvalidated para sa aming target LRLs | `comet_score` *(para sa LRLs: validated sa high-resource/EU pairs, ini-extrapolate sa hal. CRK — directionally useful ngunit uncalibrated)* |

> **Bakit lumilitaw ang `comet_score` sa dalawang row.** Ito ay paghahati ayon sa resource level, hindi kontradiksyon. Ang COMET ay *externally validated* kung saan may WMT human-correlation studies — high-resource, karamihan ay European pairs. Para sa aming target low-resource languages, walang ganoong studies, kaya ang parehong metric ay *proxy-validated* lamang: nag-e-extrapolate ang model mula sa mga wikang may ibang morphological systems. Ito rin ang dahilan kung bakit iniuulat ang COMET sa hiwalay na neural lane at hindi kailanman isinasama sa composite (§4.3).
| **🔶 Engineering heuristic** | Dinisenyo mula sa linguistic principles o observed failure modes; walang human correlation data | `fst_acceptance_rate`, `morphological_accuracy` (FST-derived, lemma-matched; **active** sa fst-coverage composite, verifier-re-derived), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 Unvalidated** | Hindi pa nasusubukan sa anumang data | `orthographic_accuracy`, `consistency_score` |

> **Ano ang ibig sabihin nito sa praktika.** Pinagsasama ng composite score (§4) ang metrics sa lahat ng validation levels. Isa itong explicit design choice: naniniwala kaming mas informative para sa polysynthetic languages ang structurally-grounded engineering heuristic (FST acceptance) kaysa isang neural metric na validated lamang sa European pairs (COMET). Ngunit hindi pa namin ito napapatunayan. Dapat ituring ang composite score bilang **engineering estimate**, hindi validated quality measurement, hanggang makumpleto ang human correlation studies para sa bawat target language.
>
> **Mga kinakailangang validation experiments** (tingnan ang `mt-evaluation-landscape.md` §6 at `speaker-validation.md`):
> 1. Human judgment correlation study: 200+ sentence pairs na ni-rate ng 3+ bilingual speakers
> 2. FST false rejection rate measurement sa isang representative corpus
> 3. Second-language port (North Sámi) upang subukan ang generalization
> 4. Direktang paghahambing sa COMET sa parehong data


---

## 2. Metric Inventory {#2-metric-inventory}

Inoorganisa ang metrics sa anim na kategorya (surface, structural, semantic, behavioral, compliance, at reported comparators). Bawat metric ay may implementation status, scale, at level (per-entry, corpus-level, o pareho).

### 2.1 Surface Metrics

Inihahambing ng surface metrics ang predicted translation sa reference translation sa string level. Hindi nangangailangan ang mga ito ng linguistic tools — string comparison lamang.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|----------------|
| `exact_match_rate` | Exact Match | ✅ Implemented | 0.0–1.0 | Pareho | Binary: ang predicted ba == reference? Corpus rate = matches / total. |
| `equivalent_match_rate` | Equivalent Match | ⚡ Partial | 0.0–1.0 | Pareho | Tumutugma ba ang predicted output sa anumang accepted variant? Para sa CRK: implemented sa pamamagitan ng CRK eval standard's `CrkLinterMetric` (sa `eval_standards/crk/`) gamit ang deterministic variant-class rules (word order, orthographic, optional particle, lemma synonym, progressive ambiguity). Awtomatikong nilo-load sa pamamagitan ng CRK language card's `evalMetrics` declaration. Nangangailangan ang generic cross-language implementation ng per-entry `variants[]` sa corpus. |
| `chrf_plus_plus` | chrF++ | ✅ Implemented | 0–100 | Pareho | Character n-gram F-score (sacrebleu). Robust sa morphological variation. Ang pangunahing surface metric para sa agglutinative/polysynthetic languages. Gumagamit ang per-entry ng `sentence_chrf`; gumagamit ang corpus ng `corpus_chrf`. |
| `bleu` | BLEU | ✅ Implemented | 0–100 | Corpus | Word-level n-gram precision (sacrebleu). **Hindi kasama sa composite** — hindi patas na pinarurusahan ng word-level scoring ang morphological variation. Kinukuwenta at iniuulat para sa compatibility sa MT literature. |
| `ter` | Translation Edit Rate | ✅ Implemented | 0–∞ (mas mababa ay mas mabuti) | Pareho | Minimum edit distance sa pagitan ng predicted at reference, normalized ayon sa reference length (sacrebleu `corpus_ter`). Kinukuwenta kasabay ng chrF++ at BLEU. Hindi kasama sa composite — correlated sa chrF++ kaya magdo-double-count ng surface similarity ang pagsasama sa pareho. |
| `length_ratio` | Length Ratio | ✅ Implemented | 0–∞ (1.0 ang ideal) | Pareho | `len(predicted) / len(reference)` sa characters. Nakakakita ng truncation (<0.5) at inflation/hallucination (>2.0). Ina-average sa lahat ng entries sa corpus level. |

### 2.2 Structural Metrics

Bine-validate ng structural metrics ang linguistic well-formedness ng translation. Nangangailangan ang mga ito ng language-specific tools (FST analyzers, morphological parsers) at ang mga ito ang pinakamalalakas na signal para sa morphologically rich languages.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|----------------|
| `fst_acceptance_rate` | FST Acceptance | ✅ Implemented | 0.0–1.0 | Pareho | Proportion ng output words na tinatanggap ng finite-state transducer (GiellaLT). Ang word ay "valid" kung nagbabalik ang FST ng kahit isang morphological analysis. Available para sa anumang wika na may GiellaLT `.hfstol` analyzer. |
| `morphological_accuracy` | Morphological Accuracy | ✅ Active (fst-coverage profile; verifier-re-derived) | 0.0–1.0 | Pareho | Maaaring FST-valid ang isang word ngunit mali ang inflection (tamang root, maling suffix). **Kinukuwenta** ng `plugins/giellalt_fst.py`: para sa bawat analyzable predicted word, humanap ng reference word na may kaparehong **lemma** (root) at tingnan kung tumutugma ang predicted **inflection** (FST feature tags). Matching by lemma — hindi position — ay umiiwas sa word alignment: ibang word choice o mis-aligned pair ay simpleng hindi *covered* (hindi kailanman falsely scored). **Walang gold annotations na kailangan** — ang FST analysis ng reference *ang* ground truth. Ang mga word na hindi ma-analyze ng FST, o ang root ay wala sa reference, ay out of coverage; idinidisclose ang `morph_coverage` (ang fraction na lemma-matched), at papasok lamang ang metric sa composite kapag coverage ≥ `MORPH_COVERAGE_FLOOR` (0.25) — sa ibaba ng floor nananatili itong advisory. Ito ay **lenient under FST ambiguity** (ang predicted word na may ilang analyses ay "correct" kung *alinman* ay tumutugma → isang upper bound, disclosed). Mayroon itong **0.15 weight** sa fst-coverage profile at **re-derived by the verifier** laban sa canonical corpus (`verifier.recompute_corpus_morph`, na muling nagpapatakbo ng card-pinned FST — fail-closed kung absent ang FST, parehong contract gaya ng COMET). Activated 2026-06-16 (migration 029 applied to dev + prod). |
| `orthographic_accuracy` | Orthographic Accuracy | 🔲 Planned | 0.0–1.0 | Pareho | Nagva-validate ng script-specific correctness: SRO macron/circumflex usage para sa Cree, diacritical marks para sa Inuktitut, vowel length markers para sa Ojibwe. Per-language rule sets. |

> **Bakit mahalaga ang mga structural metric.** Ang OMT-1600 ng Meta — ang pinakamalaking MT system na nailathala kailanman (1,600 wika; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026) — ay nagsusuri gamit ang ChrF++, xCOMET, MetricX, at BLASER 3. Wala sa mga ito ang nagva-validate ng morpolohikal na kawastuhan. Sinusukat ng ChrF++ ang overlap ng character n-gram: nagbibigay ito ng gantimpala sa mga string na *mukhang* target na wika. Para sa mga polysynthetic na wika, nangangahulugan ito na ang isang morpolohikal na hindi wastong salita na may maraming kaparehong character sa reference ay nakakakuha ng mataas na score. Ang aming FST acceptance metric ay isang binary na structural test: ang salita ay alinman sa wastong anyo sa wika, o hindi. Walang ibang MT evaluation framework ang nagbibigay nito sa scale. Mayroon ding **nonzero chance floor** ang ChrF++ na nag-iiba ayon sa orthography — ang random na same-script na teksto ay nakakakuha ng score na nasusukat na lampas sa zero, mas mataas sa ilang writing system kaysa sa iba — kaya hindi maikukumpara sa iba’t ibang wika ang raw chrF++; itinatama ito ng network map gamit ang [chance-corrected chrF++ (cchrF++)](/docs/network/specifications/connection-strength).

### 2.3 Semantic Metrics

Sinusukat ng semantic metrics ang preservation ng kahulugan gamit ang embeddings o learned models. Nahuhuli ng mga ito ang translations na surface-different ngunit meaning-equivalent, at fina-flag ang translations na surface-similar ngunit semantically wrong.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|----------------|
| `semantic_score` | Semantic Similarity | ⚡ Partial | 0.0–1.0 | Pareho | CRK: verdict-weighted score mula sa CRK eval standard's `CrkSemanticMetric` (sa `eval_standards/crk/`, proxy). Universal: cosine similarity ng sentence embeddings (source + predicted vs source + reference). Model TBD — kailangang suportahan ang low-resource languages, na nag-aalis sa karamihan ng English-centric embedding models. |
| `comet_score` | COMET | ✅ Implemented | ~0.0–1.0 | Pareho | Learned MT evaluation metric (Unbabel). **Kinukuwenta at iniuulat nang HIWALAY — hindi kailanman sa anumang composite** (deterministic ang composite; §4.3). Re-derived by the verifier, kaya dapat ma-reproduce ang isang reported value. May flag na low-resource calibration caveat para sa mga wikang tulad ng Plains Cree. Kinukuwenta kapag naka-install ang `unbabel-comet`. Para sa 35 African languages, auto-select ng harness ang AfriCOMET (`masakhane/africomet-mtl`) sa pamamagitan ng `resolve_comet_model()`, na may mas mahusay na human-judgment correlation para sa mga wikang iyon. |

> **Bakit hiwalay na iniuulat ang COMET, hindi isinasama sa composite.** Ang COMET ay trained sa WMT human-evaluation data, na labis na high-resource European pairs. Kapag inilapat sa Plains Cree o ibang LRLs, nag-e-extrapolate ang model mula sa mga wikang may ibang morphological systems — directionally useful ngunit hindi calibrated. Sa halip na isama ang model-dependent, unevenly-validated signal sa headline score, pinananatiling **deterministic** ang composite (verifier-reproducible metrics lamang) at iniuulat ang COMET/AfriCOMET sa **hiwalay na neural lane** (§4.3), re-derived by the verifier. Maaaring idagdag ang neural composite sa hinaharap, kapag validated na.
>
> **Iniuulat ang high-resource COMET, hindi isinasama sa composite (by design).** Para sa tunay na high-resource pairs (German, French, …) ang default na `Unbabel/wmt22-comet-da` ay well-validated ng WMT, at pinipili ito ng `resolve_comet_model()`. Ngunit ang COMET ay **hindi** isinasama sa anumang composite — kinukuwenta at ipinapakita ito sa hiwalay na neural lane gaya ng bawat ibang neural metric, at re-derived by the verifier. Ang pagpapanatiling deterministic ng composite ay umiiwas na gawing mandatory ang 2.3 GB model-dependent metric para sa ~100+ languages na may `metricModelSupport.xlmr.tier: "high"`, at pinananatiling reproducible ang headline score mula sa corpus lamang.

> **AfriCOMET para sa African languages.** Bawat language card ay may `metricModelSupport` field (tingnan ang language card spec §9) na nagdedeklara kung aling specialized COMET models ang trained para sa wikang iyon. Para sa 35 African languages (yor, hau, ibo, amh, swa, atbp.), idinedeklara ng card ang AfriCOMET (`masakhane/africomet-mtl`) — isang COMET model na fine-tuned sa African language MT human judgments ng Masakhane community. Auto-select ng harness ang recommended model sa pamamagitan ng `resolve_comet_model()` na nagbabasa mula sa language cards, ngunit maaari itong i-override gamit ang `--comet-model`. Ginagawa ang pagdagdag ng bagong language→model mappings sa pamamagitan ng pagpapayaman ng language card (hindi pag-edit ng Python code).

### 2.4 Behavioral Metrics

Nakakakita ang behavioral metrics ng partikular na failure modes sa translation output. Hindi nila direktang sinusukat ang kalidad — nakakakita sila ng mga problema.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|----------------|
| `code_switching_rate` | Code-Switching Rate | ✅ Implemented | 0.0–1.0 (mas mababa ay mas mabuti) | Pareho | Proportion ng output words na nasa source language (karaniwang English). Natutukoy sa pamamagitan ng Unicode script analysis at/o source-language word list. Napakakaraniwang LLM failure mode: naglalagay ang model ng English words kapag hindi nito alam ang target-language equivalent. |
| `hallucination_rate` | Hallucination Rate | ✅ Implemented | 0.0–1.0 (mas mababa ay mas mabuti) | Pareho | Proportion ng output content na walang katumbas na source content. Natutukoy sa pamamagitan ng word alignment o cross-lingual embedding overlap. Nahuhuli ang model na bumubuo ng plausible-sounding ngunit fabricated translations. |
| `terminology_adherence` | Terminology Adherence | ✅ Implemented | 0.0–1.0 | Pareho | Para sa coached methods: proportion ng prescribed terminology terms na lumilitaw sa output. Nangangailangan ng coaching dictionary data. Sinusukat kung iginagalang ng model ang expert-provided vocabulary. |
| `consistency_score` | Cross-Entry Consistency | 🔲 Planned | 0.0–1.0 | Corpus lamang | Isinasalin ba ng model ang parehong source term sa parehong paraan sa iba't ibang entries? Ang mababang consistency ay nagpapahiwatig na nanghuhula ang model sa halip na mag-apply ng learned patterns. Nangangailangan ng repeated terms sa corpus entries. |

### 2.5 Compliance Metrics

Bine-validate ng compliance metrics na napapanatili ng translations ang structural integrity — placeholders, formatting, at typography conventions. Quality-gate checks ang mga ito, hindi quality scores.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|----------------|
| `compliance_index` | Double-Pass Compliance | ✅ Implemented | 0.0–1.0 | Pareho | Weighted composite: 60% variable integrity (napapanatili ba ang `{placeholder}` vars?) + 20% quote compliance (tamang quote characters ayon sa language card) + 20% casing compliance (walang Latin letter leakage para sa caseless languages). Kinukuwenta sa raw at post-processed output. Sa pamamagitan ng `DoublePassCompliancePlugin`. |
| `repair_effectiveness` | Repair Effectiveness | ✅ Implemented | 0.0–1.0 | Corpus | Proportion ng compliance violations na awtomatikong na-repair ng post-translation hooks. Sinusukat kung gaano kalaki ang improvement ng quality gate sa raw output. |

> **Bakit wala sa composite ang compliance.** Sinusukat ng compliance metrics ang structural preservation (placeholders, quotes), hindi translation quality. Maaaring perpekto ang isang translation linguistically ngunit pumalya sa compliance dahil nag-drop ito ng `{name}` variable. Quality gates ang mga ito — hinaharangan nila ang bad output mula sa shipping, ngunit hindi nila niraranggo ang translation quality.

### 2.6 Reported comparators (HINDI KAILANMAN sa composite)

Iniuulat ang mga ito para sa context/comparison lamang at hindi kailanman pumapasok sa anumang composite profile:

| ID | Metric | Status | Notes |
|----|--------|--------|-------|
| `spbleu` | spBLEU (FLORES-200 tokenizer) | ✅ Implemented | BLEU sa FLORES-200 SentencePiece tokenization — comparable across scripts/segmentation (ang NLLB/FLORES lingua-franca). Kailangan ang `sentencepiece` (core dep). |
| `chrf_plain` | Plain chrF (`word_order=0`) | ✅ Implemented | Ang chrF figure na iniuulat ng FLORES/WMT tables, kasabay ng aming chrF++ (`word_order=2`). |
| `fuse_score` | FUSE-style comparator | ⚡ Opt-in (`--fuse`) | Isang **UNTRAINED reimplementation** ng AmericasNLP-2025 FUSE approach (Raja & Vats): LaBSE semantic + lexical token-F1 + phonetic Soundex + fuzzy difflib, pinagsama bilang *unweighted mean* (wala kaming human-judgment training data upang i-fit ang orihinal na Ridge/GBM, at sinasabi namin iyon). LaBSE/Soundex ang optional na `fuse` extra; kung walang LaBSE, nagbabalik ang `compute_fuse` ng `None` (disclosed) sa halip na magkunwaring may score. Bawat component na tumakbo ay nakalista sa `fuse_components`; ang resulta ay flagged na `fuse_untrained=true`. Pinahihintulutan nitong ipakita ng leaderboard ang FST-gated/structural scoring laban sa FUSE-style baseline. |

### 2.7 Metric Namespaces {#2-7-metric-namespaces}

Ang iisang metric ay may hanggang apat na coordinated names sa buong stack: ang
**canonical id** (ang `scores` key sa run card, hal. `equivalent_match_rate`),
ang Python **plugin name** na kumukuwenta nito (hal. `crk_linter`), ang language-card
**`evalMetrics` key** na nagdedeklara nito (hal. `lyss-eq`), at ang denormalized
**`run_cards` column** sa leaderboard (hal. `equivalent_match_rate`). Sadyang
magkakaiba ang mga ito — ipinapahayag ng plugin name ang *tool*, ipinapahayag ng metric id ang
*measurement* — ngunit dapat manatili silang naka-lockstep.

Ang single source of truth para sa mapping na iyon ay `shared/metric-registry.json`, na nilo-load
ng `mt_eval_harness.metric_manifest`. Itinatala ng bawat entry ang apat na names plus `scale`,
`direction` (higher/lower/neutral), `level` (entry/corpus/both), `in_composite`, at
`verifier_reproducible`. Ang parity test na `arena/tests/test_metric_registry_ssot.py`
ay pumapalyang kung ang weight tables ng `scoring.py` o ang run-card `scores` keys na ginawa ng
`publish.py` ay lumihis mula sa registry, kaya hindi maaaring mag-ship ang bagong metric na half-wired.

Ginagawang explicit ng dalawang kaugnay na run-card fields ang metric provenance:

- **`scores.metric_availability`** — isang `{metric: reason}` block na nagdi-disambiguate ng
  `null` score: `not_applicable` (hindi ito ginagamit ng language/run), `unavailable`
  (may nawawalang optional dependency), `below_coverage_floor` (present ngunit masyadong
  sparse upang pumasok sa composite), `not_run` (opt-in at hindi ni-request), o
  `not_implemented` (planned). Ang metric na absent mula sa block ay computed normally.
- **`fst_version`** / **`fst_provenance`** — ang installed GiellaLT transducer
  release at `pyhfst` version sa likod ng anumang FST-derived metric, na kinukuha sa parehong paraan
  gaya ng sacreBLEU signatures upang ma-trace ang structural score sa eksaktong
  analyzer build.

---

## 3. Metric Status Tiers

Bawat metric sa §2 ay kabilang sa isa sa apat na implementation tiers:

| Tier | Kahulugan | Run Card Behavior |
|------|-----------|-------------------|
| **✅ Implemented** | Umiiral ang code, tested, at gumagawa ng values sa run cards ngayon | Numeric value sa run card |
| **⚡ Partial** | May language-specific proxy (hal., CRK) ngunit pending ang universal implementation | Numeric value kapag applicable ang proxy, `null` kung hindi |
| **🔲 Planned** | Specified ngunit hindi pa implemented | `null` sa run card (field present, value absent) |
| **💡 Proposed** | Pinag-uusapan, hindi pa specified | Wala sa run card |

Lililipat ang metric mula Planned → Partial kapag:
1. Na-merge at na-test ang language-specific implementation
2. Gumagawa ito ng values para sa kahit isang language pair
3. Pending pa rin ang universal implementation (documented sa spec na ito)

Lililipat ang metric mula Partial → Implemented kapag:
1. Na-merge at na-test ang language-agnostic implementation
2. Gumagawa ito ng values para sa anumang language pair nang walang language-specific plugins
3. Na-update ang dokumentong ito upang ipakita ang ✅ status

Lililipat ang metric mula Planned → Implemented kapag:
1. Na-merge at na-test ang implementation
2. Na-validate ito sa kahit isang tunay na evaluation run
3. Na-update ang dokumentong ito kasama ang implementation details nito

Lililipat ang metric mula Proposed → Planned kapag:
1. Napagkasunduan ang definition, scale, at computation method nito
2. Idinagdag ito sa dokumentong ito na may `🔲 Planned` status
3. Idinagdag ang null placeholder sa run card schema

---

## 4. Composite Score {#4-composite-score}

> [!CAUTION]
> **Ang composite ay EXPERIMENTAL at HINDI VALIDATED.** Ito ay weighted aggregate ng metrics na *may iba't ibang ibig sabihin para sa iba't ibang wika*, na may weights na **engineering judgment, hindi empirically fitted sa human quality judgments**. Walang human-correlation study na sumusuporta sa weighting para sa anumang target language. Ituring ito bilang rough convenience sort key, **huwag kailanman** bilang quality measurement o claim na ang isang system ay "mas mabuti." Ang tunay na signal ay ang **per-metric profile** — bawat metric na ipinapakita kasama ang value at validation tier nito (§1.6). Ang composite ay labeled na "experimental — not validated" saanman ito lumitaw (kabilang ang leaderboard), at hindi kailanman ito criterion para sa anumang prize o award. (By design.)

### 4.1 Formula

Ang composite score ay weighted average ng lahat ng *available* metrics, re-normalized upang ang weights ng available metrics ay mag-sum sa 1.0:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

Ang metric ay "available" kung ang value nito sa run card ay number (hindi `null`). Kapag unavailable ang metric — dahil walang FST ang wika, o dahil hindi pa implemented ang metric — ang weight nito ay redistributed proportionally sa natitirang metrics.

**Ibig sabihin nito, ang composite ay laging comparable within a run:** ginagamit nito ang anumang metrics na available at nagno-normalize nang naaayon. Valid ang cross-run comparison kapag ang runs ay gumagamit ng parehong set ng available metrics.

> [!WARNING]
> **Cross-run comparability.** Kapag naghahambing po ng mga run na may magkakaibang metric availability (hal., ang isang run ay may mga FST score, habang ang isa ay wala), ang mga composite score ay **hindi direktang maihahambing**. Ang composite na 0.72 na kinalkula mula sa 5 metric ay nagtataglay ng mas maraming impormasyon kaysa sa composite na 0.72 na kinalkula mula sa 2 metric. Ang eksaktong metric set ng bawat run ay maaari pong i-audit: itinatala ng run card ang `scores.scoring_profile` at `scores.metric_availability` (§2.7), at ang isang hindi nasukat na metric ay ipinapakita bilang "—" sa leaderboard, at hindi kailanman bilang 0. Para po sa mahigpit na paghahambing, gumamit ng mga paired bootstrap significance test (§8.2) sa mga ibinahaging metric lamang.

### 4.2 Input Normalization

Bago pumasok sa composite formula, lahat ng metrics ay dapat nasa **0.0–1.0 scale** kung saan 1.0 = perfect:

| Metric | Native Scale | Normalization |
|--------|--------------|---------------|
| `exact_match_rate` | 0.0–1.0 | Wala (normalized na) |
| `equivalent_match_rate` | 0.0–1.0 | Wala |
| `fst_acceptance_rate` | 0.0–1.0 | Wala |
| `morphological_accuracy` | 0.0–1.0 | Wala |
| `chrf_plus_plus` | 0–100 | **I-divide by 100** |
| `semantic_score` | 0.0–1.0 | Wala |
| `code_switching_rate` | 0.0–1.0 (lower = better) | **`1.0 - value`** (invert: 0% code-switching = 1.0) |
| `hallucination_rate` | 0.0–1.0 (lower = better) | **`1.0 - value`** (invert) |
| `terminology_adherence` | 0.0–1.0 | Wala |

Ang metrics na wala sa anumang composite profile (`bleu`, `ter`, `length_ratio`, `consistency_score`, at ang neural `comet_score`/`qe_score`) ay hindi normalized para sa layuning ito. (Hiwalay na iniuulat ang neural metrics at hindi kailanman pumapasok sa composite — §4.3.)

### 4.3 Weight Tables {#43-weight-tables}

**Named profile registry (card-driven).** Hindi na pinipili ang composite ng iisang `has_fst` boolean. Bawat language ay nagre-resolve sa isang **named profile** sa pamamagitan ng `language_cards.resolve_scoring_profile()`; pinapangalanan ng profile ang weight table, na mirrored sa `scoring.py`'s `PROFILE_REGISTRY`. Maaaring magdeklarang ang card ng `scoringProfile.basis` upang mag-override; kapag absent, nire-reproduce ng default ang legacy behavior (`fst-coverage` kapag nag-score ang FST sa run, kung hindi ay `surface-only`). Ang profile na gumawa ng bawat composite ay nakatala sa run card bilang `scores.scoring_profile`, kaya auditable ang weighting per leaderboard row.

**Inactive (reserved) metrics.** May ilang metrics na may *declared* weight sa ibaba ngunit hindi pa active, kaya nakalista ang mga ito sa `scoring.INACTIVE_METRICS` at **excluded from the composite** hanggang pareho silang computed per-entry at re-scorable by the verifier (ang trust gate). Ang pag-exclude ng absent metric ay hindi nagbabago ng score — ginagawa lamang nitong explicit ang "not yet scoring" sa halip na silent. Kasalukuyang inactive:

- `orthographic_accuracy` — kailangan ng per-language orthographic rules (hindi pa built).

(Ang `morphological_accuracy` ay inactive hanggang P5; **activated 2026-06-16** sa ilalim ng `fst-coverage` profile — kinukuwenta ito (lemma-matched; §2.2), pumapasok sa composite kapag `morph_coverage ≥ 0.25` (advisory below the floor), at re-derived by the verifier. **Neural metrics (`comet_score`, `qe_score`) ay excluded from every composite** — kinukuwenta at iniuulat sila nang hiwalay; tingnan ang "Neural metrics" sa ibaba.)

#### `fst-coverage` (Profile A): Mga Wikang MAY FST Coverage

Para sa mga wikang may available na GiellaLT finite-state transducer. May 40% ng composite ang structural metrics (FST 0.25 + morphological accuracy 0.15), na sumasalamin sa primacy ng morphological correctness para sa polysynthetic/agglutinative languages.

| Metric | Target Weight | Rationale |
|--------|---------------|-----------|
| `fst_acceptance_rate` | **0.25** | Pinakamataas na weight. Kung nirereject ng FST ang isang word, hindi ito valid form sa wika — anuman ang sabihin ng ibang metrics. Binary, structurally grounded. |
| `morphological_accuracy` | **0.15** | Maaaring FST-valid ang isang word ngunit morphologically wrong (tamang root, maling inflection). Kasama ng FST, may 40% ang structural metrics. |
| `chrf_plus_plus` | **0.15** | Character n-gram overlap: ang pinakamainam na surface-level proxy para sa polysynthetic languages. Mas mahusay nitong hinahandle ang agglutinative morphology kaysa word-level metrics. |
| `semantic_score` | **0.15** | Meaning preservation kapag diverging ang surface form. Nahuhuli ang semantically wrong translations na pumapasa sa structural checks. |
| `equivalent_match_rate` | **0.10** | Nire-reward ang acceptable variants, hindi lamang ang iisang reference translation. Mahalaga para sa mga wikang may flexible word order. |
| `code_switching_rate` | **0.05** | Pinarurusahan ang source-language leakage. Inverted: 0% code-switching = 1.0. |
| `terminology_adherence` | **0.05** | Nire-reward ang coached methods na sumusunod sa prescribed vocabulary. Active lamang kapag may coaching data. |
| `hallucination_rate` | **0.05** | Pinarurusahan ang fabricated content. Inverted: 0% hallucination = 1.0. |
| `exact_match_rate` | **0.05** | Pinakamababang weight. Masyadong strict para sa polysynthetic languages — may maraming correct translations. Pinananatili bilang ceiling check. |

> **Total: 1.00.** Kapag unavailable ang metrics, ang weights ng mga ito ay redistributed proportionally sa available metrics. Ang `morphological_accuracy` (0.15 weight) ay **active** — pumapasok ito sa composite kapag `morph_coverage ≥ 0.25` at verifier-re-derived; sa ibaba ng floor, redistributed ito tulad ng anumang unavailable metric. Kapag *absent* ito (walang FST, o sub-floor coverage), ang natitirang 8 metrics (total weight 0.85) ay bawat isa scaled by 1/0.85 ≈ 1.176. Halimbawa:
> - FST: 0.25/0.85 = 0.294
> - chrF++: 0.15/0.85 = 0.176
> - semantic: 0.15/0.85 = 0.176

#### `surface-only` (Profile B): Mga Wikang WALANG FST Coverage

Para sa mga wikang walang morphological validation tools. Pantay ang weight ng semantic at surface metrics.

| Metric | Target Weight | Rationale |
|--------|---------------|-----------|
| `semantic_score` | **0.25** | Kapag walang structural validation, ang meaning preservation ang pinakamalakas na available signal. |
| `chrf_plus_plus` | **0.25** | Kapag walang FST, ang character-level overlap ang nagiging primary surface check. |
| `equivalent_match_rate` | **0.15** | Nagbibigay ang variant matching ng structured quality assessment nang hindi nangangailangan ng morphological tools. |
| `exact_match_rate` | **0.10** | Kapag walang FST, mas malaki ang weight ng exact match bilang tanging structural validation proxy. |
| `code_switching_rate` | **0.10** | Mas mahalaga ang source language leakage kapag walang FST na huhuli sa bad output. |
| `terminology_adherence` | **0.05** | Coached vocabulary compliance. |
| `hallucination_rate` | **0.05** | Fabricated content detection. |
| `orthographic_accuracy` | **0.05** | Pinupunan ng script-specific correctness ang bahagi ng puwang na iniwan ng absent FST. |

> **Total: 1.00.** Ang `orthographic_accuracy` (0.05 weight) ay nasa `INACTIVE_METRICS` (planned, hindi pa computed). Kapag absent ito, ang natitirang 7 metrics (total weight 0.95) ay scaled by 1/0.95 ≈ 1.053 — negligible impact sa composite.

#### `no-reference`: runs na WALANG gold reference

Para sa runs na ang corpus ay **walang gold references** (hal., floor languages na may contaminated FLORES lamang na tinatanggihan naming i-score laban dito). Hindi makukuwenta ang reference-based metrics (`chrf_plus_plus`, `bleu`, `exact_match_rate`, `equivalent_match_rate`), kaya ang deterministic composite ay nakasandal sa **reference-free, verifier-reproducible** signals.

| Metric | Target Weight | Rationale |
|--------|---------------|-----------|
| `fst_acceptance_rate` | **0.40** | Hindi nangangailangan ng reference ang morphological validity; ito ang pinakamalakas na deterministic signal kapag may FST. |
| `code_switching_rate` | **0.25** | Source-language leakage (inverted). |
| `hallucination_rate` | **0.20** | Fabricated content (inverted). |
| `terminology_adherence` | **0.15** | Coached vocabulary compliance. |

> **Total: 1.00.** Deterministic at verifier-reproducible ang lahat ng apat. Kapag walang FST ang no-reference run, nagre-renormalize ang composite sa behavioral checks lamang (isang sadyang manipis, tapat na signal); ang **neural reference-free QE score (AfriCOMET-QE) ay kinukuwenta at iniuulat nang hiwalay** — tingnan ang "Neural metrics" sa ibaba — bilang adequacy signal para sa ganoong runs.

#### Neural metrics — kinukuwenta at iniuulat nang HIWALAY (wala sa anumang composite)

Ang composite ay **deterministic**: bawat metric dito ay reproducible ng verifier mula sa corpus lamang. **Excluded from every composite ang neural metrics** at ipinapakita sa sarili nilang lane (design decision — "deterministic composite; neural separate, maybe separately composited later"):

| Metric | Ano ito | Saan ito ipinapakita |
|--------|---------|----------------------|
| `comet_score` | COMET / AfriCOMET neural adequacy (reference-based) | Sarili nitong leaderboard column + run-card `neural_metrics`, na may low-resource calibration caveat. |
| `qe_score` | AfriCOMET-QE reference-free neural QE (source + MT) | Parehong hiwalay na neural lane; ang adequacy signal para sa `no-reference` runs. |

Pareho pa ring **re-derived by the verifier** (`verifier.recompute_corpus_comet` / `recompute_corpus_qe`), kaya hindi mapagkakatiwalaan ang reported neural score na hindi na-reproduce — ngunit hindi kailanman nila ginagalaw ang deterministic composite. Ang named set ay `scoring.NEURAL_METRICS`. Maaaring ipakilala ang neural composite sa hinaharap; sa ngayon, nakatayo nang hiwalay ang neural metrics.

> **Tala sa weight evolution.** Provisional ang weights na ito at ire-recalibrate habang naiipon ang human validation data. Ang pangmatagalang layunin ay i-derive ang weights empirically: aling automated metrics ang pinakamahusay na nagpe-predict ng human quality judgments para sa bawat language family?

### 4.4 Pagdaragdag ng Bagong Metric sa Composite

Upang magdagdag ng bagong metric sa composite:

1. **Tukuyin ito** sa §2 na may status na `🔲 Planned`, kasama ang scale, level, at computation method.
2. **I-implement ito** bilang MetricPlugin (o sa `tester.py` para sa core metrics).
3. **Magdagdag ng null placeholder** sa run card scores block.
4. **Magtalaga ng target weight** sa §4.3 sa pamamagitan ng pagbaba ng existing weights. Dapat mag-sum ang weights sa 1.00.
5. **I-update ang BENCHMARK_SPEC.md** §3 kung magbabago ang run card schema.
6. **I-update ang `scoring.py`** weight tables (dapat i-mirror ng code ang dokumentong ito).
7. **Magpatakbo ng validation benchmark** upang kumpirmahing gumagawa ang metric ng sensible values sa real data.
8. **I-update ang dokumentong ito** upang baguhin ang status mula `🔲` patungong `✅`.

---

## 5. Quality Tiers {#5-quality-tiers}

Ang tiers na ito ay heuristic labels sa automated composite scores. Inilalarawan ng mga ito kung ano ang karaniwang ibig sabihin ng scores sa praktika, batay sa human review ng outputs sa bawat level. **Hindi validated quality judgments ang mga ito** — human review lamang ang makapagkukumpirma ng aktuwal na usability.

> [!IMPORTANT]
> **Provisional ang automated tiers.** Ang labels na ito ay nominations para sa review, hindi quality declarations. Ang method na umaabot sa "Deployable" sa automated metrics ay candidate para sa community evaluation — hindi produktong dapat i-ship. Tanging human review ng bilingual speakers lamang ang makapagkukumpirma ng aktuwal na usability (tingnan ang [BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)). Walang method ang maaaring mag-claim ng Deployable o mas mataas nang walang community review na nagkukumpirmang sumasang-ayon ang speakers na usable ang output. Maaaring mag-iba ang tier boundaries sa iba't ibang wika habang naiipon ang human validation data.

| Tier | Composite Range | Karaniwang Nakikita ng Speaker |
|------|-----------------|--------------------------------|
| **Baseline** | 0.00–0.30 | Raw LLM output na walang language-specific support. Karamihan sa morphology ay hallucinated. |
| **Emerging** | 0.30–0.50 | May ilang tamang patterns na lumilitaw. Nakakatulong ang coaching, ngunit hindi reliable ang output. |
| **Functional** | 0.50–0.70 | Nakikilala ng speaker ang output. Karaniwang tama ang major grammatical categories. Madalas ang morphological errors. |
| **Deployable** | 0.70–0.85 | Angkop para sa draft translation na may human review. Karamihan sa morphology ay tama. |
| **Fluent** | 0.85–1.00 | Papalapit sa competent human translation. Bihira at minor ang errors. |

Provisional ang tiers na ito. Ire-recalibrate ang mga ito habang naiipon ang human validation data at natututuhan namin kung saan aktuwal na bumabagsak ang threshold na "kapaki-pakinabang ito para sa isang speaker" para sa bawat wika. Walang method ang maaaring mag-claim ng **Deployable** o mas mataas nang walang community review na nagkukumpirmang sumasang-ayon ang bilingual speakers na usable ang output.

### 5.1 Tier Thresholds (Machine-Readable)

Para sa code implementations, ang thresholds ay (evaluated top-down, first match wins):

```
composite >= 0.85  →  "fluent"
composite >= 0.70  →  "deployable"
composite >= 0.50  →  "functional"
composite >= 0.30  →  "emerging"
composite >= 0.00  →  "baseline"
composite is null  →  "unscored"
```

---

## 6. Cost Metrics

Sinusukat ng cost metrics ang financial efficiency ng isang translation method. Iniuulat ang mga ito nang hiwalay sa quality — hindi naiimpluwensyahan ng cost ang composite score (maliban sa cost-adjusted secondary ranking).

### 6.1 Token Metrics

| ID | Metric | Computation |
|----|--------|-------------|
| `prompt_tokens` | Total input tokens | Sum ng `usage.prompt_tokens` sa lahat ng API calls |
| `completion_tokens` | Total output tokens | Sum ng `usage.completion_tokens` |
| `reasoning_tokens` | Chain-of-thought tokens | Sum ng `usage.completion_tokens_details.reasoning_tokens` (0 para sa karamihan ng models) |
| `cached_tokens` | Provider-cached tokens | Sum ng `usage.prompt_tokens_details.cached_tokens` |
| `total_tokens` | Total tokens consumed | `prompt_tokens + completion_tokens` |
| `tokens_per_entry` | Average tokens per translation | ✅ `total_tokens / entry_count` |

### 6.2 Cost Metrics

| ID | Metric | Computation | Use Case |
|----|--------|-------------|----------|
| `total_cost_usd` | Total run cost | Provider-reported pricing × token counts | "Magkano ang ginastos ng benchmark na ito?" |
| `cost_per_entry_usd` | Cost per corpus entry | `total_cost_usd / entry_count` | Paghahambing ng methods sa parehong corpus |
| `cost_per_1k_tokens` | Cost per 1,000 tokens | ✅ `total_cost_usd / total_tokens × 1000` | Universal LLM efficiency — comparable across corpora |
| `cost_per_source_char` | Cost per source character | `total_cost_usd / total_source_chars` | Comparable across languages na may iba't ibang tokenization |

> **Bakit maraming cost metrics?** Nag-iiba ang haba ng isang "entry" — mas mura ang 3-word phrase kaysa paragraph. Kapaki-pakinabang ang `cost_per_entry_usd` para sa paghahambing ng methods sa *parehong* corpus (same entries = same lengths = fair comparison). Ang `cost_per_1k_tokens` ang standard LLM efficiency metric, comparable *across* corpora. Nino-normalize ng `cost_per_source_char` ang tokenization differences — ang parehong sentence ay maaaring ma-tokenize sa magkakaibang bilang ng tokens depende sa vocabulary ng model.

### 6.3 Cost-Adjusted Score

Para sa methods na gumagamit ng paid APIs, kinukuwenta namin ang secondary ranking:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

Nire-reward nito ang methods na nakakamit ang magagandang scores nang efficient. Gumagamit ito ng `cost_per_entry_usd` (hindi per-token) dahil ang cost-adjusted score ay laging kinukuwenta sa loob ng iisang benchmark (same corpus), kaya fair ang per-entry comparison.

Ang cost-adjusted score ay **secondary ranking** — niraranggo ng primary leaderboard ayon sa composite score. Sinasagot nito ang ibang tanong: "given a budget, aling method ang nagbibigay ng pinakamagandang resulta?"

---

## 7. Speed Metrics

Sinusukat ng speed metrics ang latency at throughput ng isang translation method. Tulad ng cost, hindi naiimpluwensyahan ng speed ang composite score.

| ID | Metric | Computation | Level |
|----|--------|-------------|-------|
| `elapsed_seconds` | Wall-clock run duration | `time_end - time_start` | Run |
| `avg_latency_seconds` | Mean per-entry latency | `Σ latency_s / n_entries` | Corpus |
| `median_latency_seconds` | Median per-entry latency | 50th percentile ng `latency_s` | Corpus |
| `p95_latency_seconds` | 95th percentile latency | 95th percentile ng `latency_s` | Corpus |
| `tokens_per_second` | Throughput | `total_tokens / elapsed_seconds` | Run |
| `entries_per_minute` | Translation rate | `entry_count / (elapsed_seconds / 60)` | Run |

---

## 8. Confidence at Significance

### 8.1 Bootstrap Confidence Intervals

Sinusuportahan ng lahat ng key metrics ang bootstrap confidence intervals (percentile method, n=1000 resamples, α=0.05):

| Metric | CI Reported |
|--------|-------------|
| `chrf_plus_plus` | ✅ `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (kinukuwenta lamang kapag may FST data) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (bootstrapped mula sa cached per-entry scores — walang redundant neural inference) |
| `composite` | ✅ `composite_ci_lower`, `composite_ci_upper` (kinukuwenta kapag available ang chrF++ at exact_match) |
| per-tier CIs | ✅ `confidence_intervals_by_tier` — chrF++ at exact_match CIs per difficulty level (Tier 1-5) |

### 8.2 Paired Bootstrap Significance Tests

Para sa paghahambing ng dalawang methods, kinukuwenta ng harness ang paired bootstrap resampling tests:

```
H₀: The two methods perform equally on this corpus.
H₁: One method is significantly better.
```

Kung ang p-value < 0.05 at ang confidence interval ng difference ay excludes zero, statistically significant ang difference sa 95% level.

---

## 9. Run Card Scores Schema

Tinutukoy ng seksyong ito ang hierarchical structure ng `scores` block sa isang run card. Ang schema na ito ay hinango mula sa metrics na tinutukoy sa §2–§7 at dapat panatilihing naka-sync.

```jsonc
{
  "scores": {
    // §2.1 Surface metrics
    "exact_match_rate":       0.6613,       // 0.0–1.0
    "exact_matches":          41,           // count
    "equivalent_match_rate":  0.7258,       // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     45,           // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "chrf_plus_plus":         80.65,        // 0–100 (sacrebleu native scale)
    "bleu":                   54.78,        // 0–100, NOT in composite
    "ter":                    42.3,         // ✅ implemented, 0–∞ (lower=better)
    "length_ratio":           1.03,         // ✅ implemented, ideal=1.0

    // §2.2 Structural metrics
    "fst_acceptance_rate":    1.0,          // 0.0–1.0
    "fst_accepted":           74,           // count
    "morphological_accuracy": 0.83,         // ✅ active: FST-derived, lemma-matched, verifier-re-derived (fst-coverage profile — §4.3)
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     true,         // true when active AND coverage ≥ MORPH_COVERAGE_FLOOR (0.25); else advisory
    "orthographic_accuracy":  null,         // 🔲 planned

    // §2.3 Semantic metrics
    "semantic_score":         0.6842,       // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "comet_score":            null,         // nullable; NEURAL — reported separately, not in any composite (§4.3)
    "comet_model":            "",           // model ID used for COMET

    // §2.4 Behavioral metrics
    "code_switching_rate":    0.03,         // ✅ implemented (lower=better)
    "hallucination_rate":     0.01,         // ✅ implemented (lower=better)
    "terminology_adherence":  null,         // ✅ implemented (null when no glossary)
    "consistency_score":      null,         // 🔲 planned

    // §4 Composite
    "composite":              0.8988,       // 0.0–1.0
    "quality_tier":           "fluent",     // §5 tier label
    "cost_adjusted":          null,         // §6.3 secondary ranking

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "chrf_plus_plus":     { "ci_lower": 78.2, "ci_upper": 83.1 },
      "exact_match_rate":   { "ci_lower": 0.54, "ci_upper": 0.78 },
      "corpus_comet":       { "ci_lower": 0.71, "ci_upper": 0.76 }
    },
    "confidence_intervals_by_tier": {
      "1": { "corpus_chrf": { "ci_lower": 68.1, "ci_upper": 76.5 } },
      "3": { "corpus_chrf": { "ci_lower": 36.2, "ci_upper": 47.0 } }
    },

    // Breakdowns
    "by_difficulty":          {},           // scores grouped by difficulty tier
    "by_provenance":          {},           // scores grouped by entry provenance

    // Counts
    "total":                  62,
    "evaluated":              62,
    "errors":                 0
  },

  "totals": {
    // §6.1 Token metrics
    "prompt_tokens":          13985,
    "completion_tokens":      187822,
    "reasoning_tokens":       175726,
    "cached_tokens":          0,
    // §6.2 Cost metrics
    "total_cost_usd":         1.7114,
    "cost_per_entry_usd":     0.027603,
    "cost_per_source_char":   null          // 🔲 needs source char counting
  }
}
```

> **Schema history.** Nagmungkahi ang mas naunang spec drafts ng hiwalay na `cost`, `speed`, at `tokens` blocks. Pinagsama ang mga ito sa `scores` at `totals` respectively para sa simplicity. Ang speed metrics (`tokens_per_second`, `entries_per_minute`, latencies) ay nasa `scores`; ang token counts at cost figures ay nasa `totals`.

### 9.1 Schema–Database Mapping

Ini-store nang buo ang run card JSON bilang `jsonb` column sa Supabase. Ang key metrics ay denormalized din sa top-level columns para sa sort/filter performance:

| Run Card Field | Supabase Column | Type | Index |
|---------------|-----------------|------|-------|
| `scores.composite` | `composite_score` | `real` | `idx_composite` |
| `scores.quality_tier` | `quality_tier` | `text` | — |
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `scores.bleu` | `corpus_bleu` | `real` | — |
| `scores.comet_score` | `comet_score` | `real` | — |
| `totals.total_cost_usd` | `total_cost_usd` | `real` | — |
| `totals.cost_per_entry_usd` | `cost_per_entry_usd` | `real` | — |
| `totals.cost_per_source_char` | `cost_per_source_char` | `real` | — |
| `scores.avg_latency_seconds` | `avg_latency_seconds` | `real` | — |
| `model_slug` | `model_slug` | `text` | `idx_model` |
| `condition` | `condition` | `text` | — |
| `dataset.id` | `dataset_id` | `text` | `idx_leaderboard` |
| `dataset.language_pair` | `language_pair` | `text` | — |
| `fingerprint.hash` | `fingerprint_hash` | `text` | `idx_fingerprint` |
| `scores.equivalent_match_rate` | `equivalent_match_rate` | `real` | — |
| `scores.semantic_score` | `semantic_score` | `real` | — |
| `scores.ter` | `ter` | `real` | — |
| `scores.length_ratio` | `length_ratio` | `real` | — |
| `scores.code_switching_rate` | `code_switching_rate` | `real` | — |
| `scores.hallucination_rate` | `hallucination_rate` | `real` | — |
| `scores.terminology_adherence` | `terminology_adherence` | `real` | — |
| `scores.tokens_per_second` | `tokens_per_second` | `real` | — |
| `scores.entries_per_minute` | `entries_per_minute` | `real` | — |
| `elapsed_seconds` | `elapsed_seconds` | `real` | — |
| *(full card)* | `run_card` | `jsonb` | — |

Kapag may bagong metrics na implemented, dapat idagdag ang corresponding column sa pamamagitan ng numbered migration sa `arena/migrations/`.

---

## 10. Code–Spec Synchronization

### 10.1 Canonical Source

Ang dokumentong ito (`cli/website/docs/network/specifications/scoring.md`) ang canonical source para sa:
- Metric definitions (§2)
- Composite weight tables (§4.3)
- Quality tier thresholds (§5.1)
- Cost metric formulas (§6.2)
- Run card scores schema (§9)

### 10.2 Code Mirror

Ang file na `arena/mt_eval_harness/scoring.py` ay nagmi-mirror ng weight tables at tier thresholds mula sa dokumentong ito. Ito ang **code implementation** ng §4.3 at §5.1. Kapag na-update ang dokumentong ito:

1. I-update ang `scoring.py` upang tumugma
2. Patakbuhin ang `pytest tests/test_scoring_ssot.py` upang i-validate ang alignment
3. I-update ang FAQ at website docs na nagbubuod ng weights

### 10.3 Mga Dokumentong Nagre-reference sa Spec na Ito

| Document | Ano ang Nire-reference Nito | Paano Panatilihing Naka-sync |
|----------|-----------------------------|------------------------------|
| `cli/website/docs/network/specifications/benchmark-spec.md` §4–§5 | Composite formula, weight tables, tier thresholds | I-cross-reference ang doc na ito; huwag i-duplicate ang tables |
| `website/docs/getting-started/faq.md` | Simplified weight summary | Dapat tumugma sa §4.3; mag-link pabalik sa doc na ito |
| `cli/website/docs/network/how-it-works.md` | Deployable threshold | Dapat tumugma sa §5 |
| `publish.py` sa pamamagitan ng `scoring.py` | Weight dicts + tier function | Automated test ang nagva-validate ng match |

---

## Appendix A: Metrics na WALA sa Composite (at Bakit)

| Metric | Bakit Excluded |
|--------|----------------|
| **BLEU** | Pinarurusahan ng word-level scoring ang morphological variation sa polysynthetic languages. Ang minor inflectional difference (tamang kahulugan, bahagyang ibang suffix) ay binibilang bilang complete miss. Mas mahusay itong hinahandle ng chrF++ sa character level. |
| **COMET** | Trained sa WMT data (high-resource European pairs). Para sa LRLs (hal., Cree) nag-e-extrapolate ang model at uncalibrated. Ang COMET/AfriCOMET ay **kinukuwenta at iniuulat sa hiwalay na neural lane — hindi kailanman sa anumang composite** (deterministic ang composite; §4.3) — at re-derived by the verifier. |
| **TER** | Correlated ang edit distance sa chrF++ para sa karamihan ng use cases. Magdo-double-count ng surface similarity ang pagsasama sa pareho. Iniuulat ang TER para sa reference. |
| **Length Ratio** | Diagnostic ito, hindi quality signal. Parehong maayos ang ratio na 1.02 at ratio na 0.98. Extreme values lamang ang nagpapahiwatig ng problems. |
| **Consistency Score** | Corpus-level lamang — walang per-entry value na ia-aggregate. Gayundin, legitimate ang ilang inconsistency (parehong English word → ibang target-language translations depende sa context). |
| **Compliance Index** | Quality gate, hindi quality signal. Sinusukat ang structural preservation (placeholders, quotes), hindi translation accuracy. |

## Appendix B: LYSS — Language-Specific Metric Implementations

Ang **LYSS** framework (Linguistically-informed Yield & Structural Scoring) ay nagbibigay ng language-specific metrics na lumalampas sa surface-level string comparison. May tatlong core components ang LYSS:

- **LYSS-fst** — Morphological validity (`fst_acceptance_rate`): Valid form ba sa target language ang bawat word?
- **LYSS-eq** — Linguistic equivalence (`equivalent_match_rate`): Katanggap-tanggap na variant ba ng reference ang output?
- **LYSS-sem** — Semantic validation (`semantic_score`): Napapanatili ba ng output ang source meaning?

> **Validation status: 🔶 Engineering heuristic.** HINDI pa na-validate ang LYSS metrics laban sa human quality judgments. Dinisenyo ang mga ito mula sa linguistic principles (FSTs, dictionaries, grammar rules na binuo ng linguists sa UAlberta ALTLab), ngunit hindi pa nasusukat ang correlation sa pagitan ng LYSS scores at aktuwal na translation quality. Tingnan ang [Speaker Validation Protocol](/docs/network/specifications/speaker-validation) para sa kinakailangang validation experiments.

| Language | Plugin | Location | LYSS Component | Metric Key | Notes |
|----------|--------|----------|----------------|------------|-------|
| CRK (Plains Cree) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | Deterministic variant-class rules: word order, orthographic, optional particle, lemma synonym, progressive ambiguity, inclusive/exclusive. Gumagawa ng per-entry `lint_verdict` (EXACT/EQUIVALENT/MISS/NO_OUTPUT). |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | Deterministic: FST lemma extraction + dictionary glosses + spaCy content-word overlap. Gumagawa ng verdicts (EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT). |
| GiellaLT langs | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | Generic: gumagana para sa CRK, SME, SMA, SMJ, SMN, SMS, FIN, NOB, IKU — anumang wika na may `.hfstol` analyzer. Generic ang metric, ngunit **evaluation corpora exist only for Plains Cree (crk)** ngayon, kaya crk lamang ang FST-scored language sa praktika (tingnan ang [Honest Limitations](/docs/network/honest-limitations)). |

> **Architecture note (June 2026).** Ang language-specific LYSS metrics ay ngayon idinedeklara sa language card sa ilalim ng `evalMetrics` at nilo-load mula sa `eval_standards/<lang>/` ng `plugin_discovery.py`. Ang mga ito ay **evaluation standards** (referee), hindi method plugin metrics (contestant). Ibig sabihin nito, anumang translation method na nagta-target ng CRK ay awtomatikong sine-score ng LYSS — walang method-specific configuration na kailangan. Inalis ang `CrkFSTMetric`; ang functionality nito ay ganap na covered ng generic `GiellaLTFSTMetric`.

## Appendix C: Metrics Under Consideration

Ito ang mga ideyang ine-evaluate ngunit hindi pa sapat na specified para sa §2:

| Idea | Ano ang Susukatin Nito | Blockers |
|------|------------------------|----------|
| Fluency (LM perplexity) | Well-formed prose ba ang output sa target language? | Nangangailangan ng target-language LM. Walang magagandang models para sa karamihan ng LRLs. |
| Register match | Tugma ba ang translation sa expected formality level? | Nangangailangan ng sociolinguistic classifiers. Research problem. |
| Cultural appropriateness | Tama ba ang paghawak sa cultural references? | Hindi maaaring i-automate — inherently nangangailangan ng human review. |
| Discourse coherence | Bumubuo ba ng coherent passage ang consecutive translations? | Nangangailangan ng document-level evaluation, hindi sentence-level. |

---

## References

Academic papers, tools, at language resources na cited sa buong espesipikasyong ito.

### Surface Metrics

1. Popović, M. (2017). "chrF++: words helping character n-grams." *Proceedings of the Second Conference on Machine Translation (WMT 2017)*, pp. 612–618. Copenhagen, Denmark.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. Belgium, Brussels. Reference implementation: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

### Neural Metrics

5. Rei, R., Stewart, C., Farinha, A. C., & Lavie, A. (2020). "COMET: A Neural Framework for MT Evaluation." *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP 2020)*, pp. 2685–2702. Online.

6. Juraska, J., Finkelstein, M., Deutsch, D., Siddhant, A., Mirzazadeh, M., & Freitag, M. (2023). "MetricX-23: The Google Submission to the WMT 2023 Metrics Shared Task." *Proceedings of the Eighth Conference on Machine Translation (WMT 2023)*, Singapore. (ACL Anthology 2023.wmt-1.63)

7. Zhang, T., Kishore, V., Wu, F., Weinberger, K. Q., & Artzi, Y. (2020). "BERTScore: Evaluating Text Generation with BERT." *Proceedings of the Eighth International Conference on Learning Representations (ICLR 2020)*. Addis Ababa, Ethiopia.

8. Sellam, T., Das, D., & Parikh, A. (2020). "BLEURT: Learning Robust Metrics for Text Generation." *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics (ACL 2020)*, pp. 7881–7892. Online.

### Morphological and Linguistic Tools

9. Lindén, K., Silfverberg, M., Axelson, E., Hardwick, S., & Pirinen, T. (2011). "HFST—Framework for Compiling and Applying Morphologies." *Systems and Frameworks for Computational Morphology (SFCM 2011)*, Communications in Computer and Information Science, vol. 100, pp. 67–85. Springer, Berlin, Heidelberg.

10. Sánchez-Cartagena, V. M., & Toral, A. (2024). "MorphEval: Automatic Evaluation of Morphological Capabilities of Machine Translation Systems." *Machine Translation*, vol. 38, pp. 1–28.

### Error Classification and Diagnostic Evaluation

11. Popović, M. (2011). "Hjerson: An Open Source Tool for Automatic Error Classification of Machine Translation Output." *The Prague Bulletin of Mathematical Linguistics*, no. 96, pp. 59–68.

12. Dreyer, M. & Marcu, D. (2012). "HyTER: Meaning-Equivalent Semantics for Translation Evaluation." *Proceedings of the 2012 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2012)*, pp. 162–171. Montréal, Canada.

13. Reiter, E. & Belz, A. (2009). "An Investigation into the Validity of Some Metrics for Automatically Evaluating Natural Language Generation Systems." *Computational Linguistics*, vol. 35, no. 4, pp. 529–558. (Related work on feature-based evaluation metrics, including FUSE.)

### Hallucination Detection

14. Raunak, V., Menezes, A., & Junczys-Dowmunt, M. (2021). "The Curious Case of Hallucinations in Neural Machine Translation." *Proceedings of the 2021 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2021)*, pp. 1172–1183. Online.

15. Guerreiro, N. M., Voita, E., & Martins, A. F. T. (2023). "Looking for a Needle in a Haystack: A Comprehensive Study of Hallucinations in Neural Machine Translation." *Proceedings of the 17th Conference of the European Chapter of the Association for Computational Linguistics (EACL 2023)*, pp. 1059–1075. Dubrovnik, Croatia.

### Cree Language Resources

16. Wolfart, H. C. (1973). "Plains Cree: A Grammatical Study." *Transactions of the American Philosophical Society*, vol. 63, no. 5, pp. 1–90.

17. Wolvengrey, A. (2001). *nêhiyawêwin: itwêwina / Cree: Words.* Canadian Plains Research Center, University of Regina.

### Data Governance

18. Global Indigenous Data Alliance. "CARE Principles for Indigenous Data Governance." [https://www.gida-global.org/care](https://www.gida-global.org/care).

19. Carroll, S. R., Garba, I., Figueroa-Rodríguez, O. L., Holbrook, J., Lovett, R., Materechera, S., Parsons, M., Raseroka, K., Rodriguez-Lonebear, D., Rowe, R., Sara, R., Walker, J. D., Anderson, J., & Hudson, M. (2020). "The CARE Principles for Indigenous Data Governance." *Data Science Journal*, vol. 19, no. 1, p. 43.
