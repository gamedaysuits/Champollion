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

> **Executive Summary.** Ito ang nag-iisang mapagkukunan ng katotohanan para sa kung paano binibigyang-puntos ang mga run sa MT evaluation ecosystem ng Champollion: ang natatanging headline metric, ang iba pang karaniwang sukatan na iniuulat kasabay nito, ang mga diagnostic na hiwalay na iniuulat, gayundin ang gastos at bilis. Binibigyang-puntos ang mga run sa paraang ginagamit sa larangan: **corpus-level chrF++ kalakip ang sacreBLEU signature nito at 95% bootstrap confidence interval**, kasama ang BLEU, spBLEU, TER, at COMET sa tabi nito, at mga paired significance test upang matukoy kung mas mahusay ang isang sistema kaysa sa isa pa. Ang mga diagnostic na partikular sa wika (FST morphological validity, mga linter equivalence class, deterministic semantic validation) ay sama-samang tinatawag na **LYSS** (Linguistically-informed Yield & Structural Scoring). Ang weighted composite at ang mga quality-tier label na dating ginamit ay **itinigil na** (§4, §5); nananatili lamang ang mga talahanayan ng mga ito rito upang ma-verify pa rin ang mga lumang card. Ang code, dokumentasyon, at mga database schema ay hango sa dokumentong ito. Kung magkaroon ng salungatan, ang dokumentong ito ang may kapangyarihan.
>
> **Saklaw.** Tinutukoy ng dokumentong ito kung *ano* ang aming sinusukat at *paano namin ito binibigyang-puntos*. Hindi nito tinutukoy ang run card schema (tingnan ang BENCHMARK_SPEC §3), ang benchmark protocol (BENCHMARK_SPEC §6), o ang mga panuntunan sa leaderboard (tingnan ang arena docs). Sumasangguni ang mga dokumentong iyon dito para sa mga kahulugan ng sukatan at lohika ng pagmamarka.


---

## Paano binibigyang-puntos ang mga run {#how-runs-are-scored}

Bawat bagong run ay binibigyang-puntos sa ilalim ng **pamantayan sa pagmamarka na `standard/1`**. Isinasaad ito ng run card: ang `scores.scoring_standard` ay `"standard/1"` at ang `scores.primary_metric` ay `"chrf_plus_plus"`.

| Papel | Ano | Saan lumalabas |
|-------|-----|----------------|
| **Headline at ranking metric** | Corpus-level na **chrF++** (sacreBLEU chrF na may `word_order=2`), 0–100, kalakip ang 95% bootstrap confidence interval nito at ang sacreBLEU signature nito | Isinusulat bilang `chrF++ 47.5 [45.9, 49.0]`, na sinusundan ng signature. Run card: `scores.chrf_plus_plus`, ang CI sa `scores.confidence_intervals.corpus_chrf`, ang signature sa `scores.sacrebleu_signatures.chrf`. Database: `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper`. |
| **Iba pang karaniwang sukatan** | BLEU, spBLEU (FLORES-200 SentencePiece), TER, at COMET kapag nakalkula ito | Ipinapakita sa tabi ng chrF++, bawat isa ay may signature o COMET model id nito. Hindi kailanman inihahalo sa chrF++ o sa isa't isa. |
| **Mga Diagnostic** | Exact match, FST acceptance, morphological accuracy, code-switching, hallucination, terminology adherence, writing style, at bawat score caveat (§2.8) | Hiwalay na iniuulat at may label na mga diagnostic. Hindi kailanman pumapasok ang mga ito sa headline number at hindi nagraranggo ng run. Nananatiling kapansin-pansin ang mga caveat sa tabi ng headline. |
| **Gastos at bilis** | Mga token, dolyar, latency (§6, §7) | Iniuulat sa tabi ng puntos, hindi kailanman isinasama rito. |

**Pagpapasya kung alin ang "mas mahusay".** Ang dalawang run sa parehong evaluation set ay inihahambing gamit ang isang paired significance test sa chrF++ (approximate randomization bilang default, paired bootstrap resampling bilang opsyon; §8.2). Sinusuri at ipinapakita rin ang iba pang karaniwang sukatan. Ang pagkakaibang hindi makabuluhan (not significant) ay iniuulat bilang hindi makabuluhan, anuman ang dalawang numero.

**Walang mga label ng kalidad.** Ang awtomatikong puntos ay hindi hatol sa kalidad. Walang dalang tier at walang label tulad ng "functional" o "deployable" ang mga bagong card; tanging human evaluation lamang ng mga tagapagsalita ang nagpapatunay sa kalidad ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

**Ang mga itinigil na.** Ang mga bagong card ay nagpa-publish ng `composite: null`, `quality_tier: null` at `cost_adjusted: null` (ang cost-adjusted score ay ang composite na hinati sa cost factor; iniuulat pa rin ang mismong gastos). Walang bagong output na nagpi-print ng composite o tier. Ang mga card na na-publish bago ang pamantayan ay nagpapanatili ng nakaimbak na composite ng mga ito at nananatiling nabe-verify: muling kinakalkula ng verifier ang isang card na walang `scoring_standard` gamit ang legacy computation (§4), at ang isang `standard/1` card sa pamamagitan ng muling pagkalkula ng chrF++. Saanman ipinapakita pa rin ang composite ng lumang card, ito ay may label na **legacy composite (itinigil na)**.

**Bakit ito ang pamantayan.** Ganito iniuulat ng larangan ang MT evaluation:

- Niraranggo ng **WMT** ang mga shared-task system nito sa pamamagitan ng human evaluation at iniuulat ang mga awtomatikong sukatan sa tabi nito kalakip ang mga sacreBLEU signature upang kopyahin o ma-reproduce ang mga numero (Post 2018; Kocmi et al. 2024).
- Iniuulat ng **FLORES-200** (NLLB Team 2022) ang chrF++ at spBLEU para sa 200 wika, karamihan sa mga ito ay low-resource.
- Niraranggo ng mga shared task ng **AmericasNLP** sa pagsasalin sa mga Katutubong wika ng Americas ang mga sistema ayon sa chrF (Mager et al. 2021; Ebrahimi et al. 2023), dahil mas nakakayanan ng character n-grams ang mayamang morpolohiya kaysa sa word-level BLEU (Popović 2015, 2017).
- Natuklasan nina Kocmi et al. (2021), sa paghahambing ng mga awtomatikong sukatan laban sa libu-libong paghuhusga ng tao, na ang laki ng pagkakaiba ng sukatan at kung ito ay makabuluhan ayon sa estadistika ang nagpapahiwatig ng kagustuhan ng tao, kung kaya't ang mga paghahambing dito ay mga paired significance test (Koehn 2004; Riezler & Maxwell 2005), hindi dalawang numerong magkatabi lamang.

**Mga contest.** Ang qualifier ng isang contest ay chrF++ lamang, mula 0–100, at ang `primary_metric` ng isang contest ay naka-default sa `chrf_plus_plus`. Ang isang bagong contest na humihiling ng `composite` bilang sukatan nito ay tinatanggihan nang may dahilan; patuloy na gumagana ang mga contest na ginawa bago ang pamantayan. Maaari pa ring magtakda ang isang organizer ng mga diagnostic gate sa mga tuntunin ng premyo (halimbawa, isang minimum na FST acceptance), bilang mga gate na dapat maipasa ng isang isinumite, hindi kailanman bilang puntos ([Prize Specification](/docs/network/specifications/prizes)).

**Pagbabago sa pamantayan.** Nagbabago lamang ang headline metric kalakip ang isang bagong bersyon ng pamantayan (`standard/2`). Isinasaad ng bawat card ang pamantayang ginamit sa pagmamarka rito at bine-verify sa ilalim ng pamantayang iyon.

---

## 1. Pilosopiya ng Pagmamarka

### 1.1 Pilosopiya ng Microeval

> *"Kung magtutuon lamang tayo sa kung ano ang nag-ge-generalize, tiyak na malilimutan natin ang mga lugar kung saan hindi ito umaangkop — at mawawala sa atin ang mga wikang ito at ang lahat ng kanilang kaalaman at karunungan."*

Isinasagawa ng proyektong ito ang **microeval development**: pagbuo ng evaluation metrics na iniangkop sa partikular na mga wika gamit ang pinakamahuhusay na linguistic tools na available — finite-state transducers, bilingual dictionaries, morphological analyzers, linguist-curated equivalence rules. Kabaligtaran ito ng nangingibabaw na paradigma sa MT evaluation, na naghahanap ng universal metrics na gumagana sa lahat ng wika. Mahalaga ang universal metrics, ngunit pinakamahina ang mga ito mismong kung saan sila pinakakailangan: para sa mga wikang may kumplikadong morphology, limitadong training data, at walang representasyon sa neural metric training sets.

Hindi tayo umuunlad sa machine translation para sa marami sa mga wika sa mundo hindi lamang dahil kulang tayo sa corpora, kundi dahil **hindi nga natin alam kung ano ang itsura ng progreso** — kulang tayo sa automated evaluation tools upang masukat kung bumubuti ba ang isang translation system. Ang LYSS ang aming pagtatangkang buuin ang mga tool na iyon, wika bawat wika, gamit ang anumang linguistic resources na mayroon.

### 1.2 Ang Automated Metrics ay Mga Proxy

Bawat sukatang tinukoy rito ay kinakalkula ng makina. Kapaki-pakinabang ang mga ito para sa mabilisang pag-ulit (iteration), sistematikong paghahambing, at pagtukoy ng mga regression. **Hindi kapalit ang mga ito para sa paghuhusga ng tao**, kung kaya't walang awtomatikong puntos ang may dalang label ng kalidad — tanging pagsusuri lamang ng tao ang makapagpapatunay sa aktwal na kakayahang magamit (usability).

### 1.3 Isang Headline, Maraming Signal

Walang nag-iisang sukatang sumasaklaw sa kalidad ng pagsasalin. Ang isang salin ay maaaring magkaroon ng mataas na chrF++ overlap ngunit bumagsak sa morphological validation. Maaari itong pumasa sa mga pagsusuri ng FST ngunit magdala ng maling kahulugan. Maaari itong maging tumpak ayon sa semantika ngunit hindi natural ang estilo para sa target na wika. Kaya nag-uulat ang bawat run ng maraming signal — ngunit isa lamang sa mga ito, ang chrF++, ang headline at ranking metric, at ang iba pa ay ipinapakita sa tabi nito, hindi kailanman inihahalo rito. Ang pinaghalong mga signal na magkakaiba ang kahulugan para sa iba't ibang wika ay maaaring manipulahin ng isang sistemang mahusay sa mga mumurahing signal (nakatala sa §4 kung paano ang itinigil na composite noon), at hindi matutukoy ng mambabasa mula sa pinaghalong numero kung aling signal ang nagbago.

### 1.4 Extensibility

Hindi sarado ang imbentaryo ng sukatang ito. Nagdadala ang mga bagong wika ng mga bagong kinakailangan: tone accuracy para sa mga tonal na wika, diacritical precision para sa mga Semitic script, kawastuhan ng syllabary para sa Cree. Ang arkitektura (MetricPlugin protocol) ay nagpapahintulot na magdagdag ng mga diagnostic nang hindi binabago ang anumang headline score. Ang mga sukatang partikular sa wika (hal., ang linter at semantic validator ng CRK) ay idinedeklara sa mga language card sa ilalim ng `evalMetrics` at inilo-load mula sa `eval_standards/` — ang harness ay nagpapadala lamang ng mga generic na behavioral metric (code-switching, hallucination, terminology).

### 1.5 Tatlong Dimensyon ng Evaluation

Bawat run card ay sumusukat ng tatlong independent dimensions:

```
Quality   — How close is the translation to the reference?   (chrF++ headline + standard metrics + diagnostics)
Cost      — How much does it cost?                           (cost metrics, §6)
Speed     — How fast does it run?                            (speed metrics, §7)
```

Mga independiyenteng axis ang mga ito. Ang isang pamamaraan ay maaaring makakuha ng mataas na puntos ngunit magastos, mabilis ngunit hindi tumpak, o anumang kombinasyon. Nagbibigay-daan ang leaderboard na mag-uri-uri ayon sa anumang dimensyon. Walang nai-publish na numerong nagsasama sa mga ito (ang cost-adjusted score na gumawa nito, §6.3, ay itinigil na).

### 1.6 Validation Status

Bawat metric sa espesipikasyong ito ay may **validation status** na hiwalay sa implementation status nito (§3). Sinusubaybayan ng implementation status kung umiiral ang code. Sinusubaybayan ng validation status kung naipakita na bang may correlation ang metric sa human quality judgments.

| Validation Level | Kahulugan | Kasalukuyang Metrics |
|------------------|-----------|----------------------|
| **✅ Externally validated** | May mga published human-correlation studies (WMT, academic papers) | `chrf_plus_plus`, `bleu`, `comet_score` *(high-resource pairs lamang)* |
| **⚡ Proxy-validated** | Validated para sa high-resource languages; unvalidated para sa aming target LRLs | `comet_score` *(para sa LRLs: validated sa high-resource/EU pairs, ini-extrapolate sa hal. CRK — directionally useful ngunit uncalibrated)* |

| **🔶 Engineering heuristic** | Idinisenyo mula sa mga prinsipyong panglinggwistika o naobserbahang failure mode; walang data ng human correlation | `fst_acceptance_rate`, `morphological_accuracy` (hango sa FST, lemma-matched, muling kinalkula ng verifier), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 Hindi na-validate** | Hindi pa nasusubukan sa anumang data | `orthographic_accuracy`, `consistency_score` |

> **Bakit lumalabas ang `comet_score` sa dalawang hanay.** Paghahati ito ayon sa antas ng resource, hindi isang kontradiksyon. Ang COMET ay *externally validated* kung saan umiiral ang mga pag-aaral ng WMT sa ugnayan sa tao — mga high-resource, karaniwang European na pares. Para sa aming mga target na low-resource na wika, walang ganoong pag-aaral, kaya ang parehong sukatan ay *proxy-validated* lamang: nag-e-extrapolate ang modelo mula sa mga wikang may magkakaibang morphological system. Ipinapakita ito sa tabi ng chrF++ kalakip ang model id nito at paunawa sa pag-calibrate, hindi kailanman pinaghalo.

> **Ang ibig sabihin nito sa praktika.** Ang headline (chrF++) ay isang externally validated metric, na ginagamit sa paraang ginagamit ito sa larangan. Ang bawat engineering heuristic sa itaas ay isang **diagnostic**: maipapaliwanag nito kung *bakit* nagkaroon ng ganoong puntos ang isang run (ang mga salita ay hindi wastong anyo, lumipat sa Ingles ang output), ngunit hindi ito kailanman puntos at hindi nagraranggo ng isang run. Isinama ng itinigil na composite (§4) ang mga heuristic sa lahat ng antas ng pagpapatunay sa headline, at maaaring makuha ng isang sistema ang karamihan dito nang hindi nagsasalin (§4).
>
> **Mga kinakailangang eksperimento sa pagpapatunay** (tingnan ang `mt-evaluation-landscape.md` §6 at `speaker-validation.md`):
> 1. Pag-aaral sa ugnayan ng paghuhusga ng tao: 200+ pares ng pangungusap na minarkahan ng 3+ bilingguwal na tagapagsalita
> 2. Pagsukat sa false rejection rate ng FST sa isang kinatawang corpus
> 3. Paglipat sa pangalawang wika (North Sámi) upang subukan ang paglalahat (generalization)
> 4. Direktang paghahambing sa COMET sa parehong data


---

## 2. Metric Inventory {#2-metric-inventory}

Ang mga sukatan ay nakaayos sa anim na kategorya (surface, structural, semantic, behavioral, compliance, at reported comparators). Bawat sukatan ay may katayuan ng pagpapatupad (implementation status), iskala, at antas (bawat entry, corpus-level, o pareho), at isa sa tatlong papel sa ilalim ng pamantayan: **headline** (chrF++ lamang), **standard** (BLEU, spBLEU, TER, COMET — ipinapakita sa tabi ng headline), o **diagnostic** (lahat ng iba pa — hiwalay na iniuulat).

### 2.1 Surface Metrics

Inihahambing ng surface metrics ang predicted translation sa reference translation sa string level. Hindi nangangailangan ang mga ito ng linguistic tools — string comparison lamang.

| ID | Sukatan | Katayuan | Iskala | Antas | Pagpapatupad |
|----|--------|--------|-------|-------|---------------|
| `exact_match_rate` | Exact Match | ✅ Naipatupad | 0.0–1.0 | Pareho | **Diagnostic.** Binary: predicted == reference ba? Rate ng corpus = mga tugma / kabuuan. |
| `equivalent_match_rate` | Equivalent Match | ⚡ Bahagya | 0.0–1.0 | Pareho | **Diagnostic.** Tumutugma ba ang hinulaang output sa anumang tinatanggap na baryant? Para sa CRK: ipinatupad sa pamamagitan ng `CrkLinterMetric` ng pamantayan sa pagsusuri ng CRK (sa `eval_standards/crk/`) gamit ang mga deterministic variant-class rule (ayos ng salita, ortograpiko, opsyonal na particle, kasingkahulugan ng lemma, progressive ambiguity). Awtomatikong inilo-load sa pamamagitan ng deklarasyong `evalMetrics` ng CRK language card. Ang pangkalahatang pagpapatupad sa iba't ibang wika ay nangangailangan ng `variants[]` bawat entry sa corpus. |
| `chrf_plus_plus` | chrF++ | ✅ Naipatupad | 0–100 | Pareho | **Headline at ranking metric.** Character n-gram F-score na may mga word unigram at bigram (sacreBLEU chrF, `word_order=2`; Popović 2017). Matatag laban sa baryasyong morpolohikal. Ang nai-publish na halaga ay corpus-level (`corpus_chrf`), na may 95% bootstrap CI at ang sacreBLEU signature nito; ang mga halaga bawat entry (`sentence_chrf`) ang nagpapakain sa mga significance test. |
| `bleu` | BLEU | ✅ Naipatupad | 0–100 | Corpus | **Karaniwang sukatan, ipinapakita sa tabi ng chrF++** (run card at database `corpus_bleu`, kalakip ang sacreBLEU signature nito). Word-level n-gram precision (Papineni et al. 2002). Hindi headline dahil itinuturing ng word-level matching ang isang tamang salita na may ibang hulapi bilang ganap na mali, na nagpaparusa sa mga wikang mayaman sa morpolohiya. |
| `ter` | Translation Edit Rate | ✅ Naipatupad | 0–∞ (mas mababa ay mas mainam) | Pareho | **Karaniwang sukatan, ipinapakita sa tabi ng chrF++** (`scores.ter`, kalakip ang sacreBLEU signature nito). Minimum edit distance sa pagitan ng hinulaan at reference, na na-normalize ayon sa haba ng reference (sacreBLEU `corpus_ter`; Snover et al. 2006). |
| `length_ratio` | Length Ratio | ✅ Naipatupad | 0–∞ (1.0 ang perpekto) | Pareho | **Diagnostic.** `len(predicted) / len(reference)` sa mga character. Pagtukoy sa truncation (<0.5) at inflation/hallucination (>2.0). Naka-average sa mga entry sa antas ng corpus. |

### 2.2 Structural Metrics

Bine-validate ng structural metrics ang linguistic well-formedness ng translation. Nangangailangan ang mga ito ng language-specific tools (FST analyzers, morphological parsers) at ang mga ito ang pinakamalalakas na signal para sa morphologically rich languages.

| ID | Sukatan | Katayuan | Iskala | Antas | Pagpapatupad |
|----|--------|--------|-------|-------|---------------|
| `fst_acceptance_rate` | FST Acceptance | ✅ Naipatupad | 0.0–1.0 | Pareho | **Diagnostic.** Pagtanggap sa mga output na salita ng isang finite-state transducer (GiellaLT). Ang isang salita ay "wasto" kung nagbabalik ang FST ng kahit isang morphological analysis. **Pagsasama-sama (Aggregation):** ang nai-publish na halaga ng corpus ay ang **mean ng mga rate bawat entry** — mga tinanggap na salita ng bawat entry ÷ mga salita nito, na kinuha ang average sa mga entry na sinuri ng FST, kung saan ang walang lamang output ay binibilang bilang 0 (ang `avg_fst_validity` ng plugin). Ang pooled word rate (lahat ng tinanggap na salita ÷ lahat ng salita, `corpus_validity_rate`) ay iniuulat sa tabi nito sa run report at sa run card ngunit hindi ito ang nai-publish na halaga; magkaiba ang dalawa kapag magkaiba ang haba ng mga entry. Magagamit para sa anumang wikang may GiellaLT `.hfstol` analyzer. **Case:** tinitingnan ang isang salita ayon sa pagkakasulat nito; kung tatanggihan ito ng FST at nagsisimula ito sa malaking titik, tinitingnan itong muli na ginawang maliit ang unang titik (`Mun` → `mun`), at ang salitang NAKA-CAPS LAHAT bilang Titlecase at pagkatapos ay sa maliit na titik (`OSLO` → `Oslo`, `GIITU` → `giitu`). Hindi kailanman pabaliktad: ang isang pangngalang pantangi na nakasulat sa maliit na titik (`oslo`) ay mananatiling tinanggihan. Inililista ng mga spell-checker acceptor ng GiellaLT (Northern Sámi, Amharic, Basque) at ng strict Plains Cree analyser ng ALTLab ang karamihan sa mga salita sa maliit na titik lamang at ipinauubaya ang case sa program sa paligid ng mga ito, kaya kung wala ito, ang isang wastong malaking titik sa simula ng pangungusap ay mabibilang bilang hindi wastong salita. Ito ang computation version `case-fallback/1`, na pinangalanan sa ulat (`fst_acceptance_method`, kalakip ang `total_case_folded_words` at ang `fst_case_folded_words` ng bawat entry) at sa run card (`fst_provenance.acceptance_method`). Ang isang ulat na wala nito ay minarkahan nang case-sensitive at mas mababa ang lumalabas para sa naka-capitalize na teksto; sinasabi ito ng `mt-eval compare` kapag inihahambing nito ang dalawa, at muling minamarkahan ng `mt-eval test <run log>` ang isang lumang run. Muling kinakalkula ng verifier ang mga numerong hango sa FST ng isang nai-publish na card gamit ang pamamaraang tinukoy ng card na iyon, at ang isang card na walang ganoon ay case-sensitively, upang masuri ang card laban sa kalkulasyon kung saan ito na-publish. |
| `morphological_accuracy` | Morphological Accuracy | ✅ Naipatupad (muling kinalkula ng verifier) | 0.0–1.0 | Pareho | **Diagnostic.** Ang isang salita ay maaaring FST-valid ngunit may maling inflection (tamang ugat, maling hulapi). **Kinakalkula** ng `plugins/giellalt_fst.py`: para sa bawat nasusuring hinulaang salita, maghanap ng salita sa reference na kapareho nito ng **lemma** (ugat) at suriin kung tumutugma ang hinulaang **inflection** (mga FST feature tag). Ang pagtutugma ayon sa lemma — hindi sa posisyon — ay umiiwas sa word alignment: ang ibang pagpili ng salita o isang hindi nakahanay na pares ay sadyang hindi *saklaw* (hindi kailanman maling mamarkahan). **Walang kailangang gold annotation** — ang pagsusuri ng FST sa reference *mismo* ang ground truth. Ang mga salitang hindi masuri ng FST, o ang ugat ay wala sa reference, ay labas sa saklaw; isinisiwalat ang `morph_coverage` (ang bahaging tumugma sa lemma), at kapag mas mababa sa `MORPH_COVERAGE_FLOOR` (0.25) ang halaga ay minamarkahan bilang advisory. Ito ay **maluwag (lenient) sa ilalim ng FST ambiguity** (ang isang hinulaang salitang may ilang pagsusuri ay "tama" kung *alinman* ay tumutugma → isang upper bound, na isinisiwalat). Nangangailangan ito ng isang **analyzer**: ang isang FST na spell-checker **acceptor** lamang (ang mga package ng Divvun speller na naka-install para sa Northern Sámi, Amharic at Basque) ay nagsasabi kung umiiral ang isang salita ngunit hindi nagbibigay ng lemma o mga tag. Para sa mga iyon, ang `morphological_accuracy` at `morph_coverage` ay null at sinasabi ng `metric_availability` kung bakit; iniuulat pa rin ang FST acceptance. Idinedeklara ito ng FST pin (`kind: "acceptor"`), at natutukoy din ng sukatan ang isang transducer na hindi kailanman nagbabalik ng tag. Ito ay **muling kinakalkula ng verifier** laban sa canonical corpus (`verifier.recompute_corpus_morph`, na muling nagpapatakbo sa naka-pin na FST ng card — magfe-fail-closed kung wala ang FST, kaparehong kasunduan sa COMET). Sa ilalim ng itinigil na composite, nagdala ito ng 0.15 na timbang sa fst-coverage profile (§4.3). |
| `orthographic_accuracy` | Orthographic Accuracy | 🔲 Nakaplano | 0.0–1.0 | Pareho | **Diagnostic (nakaplano).** Nagsusuri sa kawastuhan na partikular sa script: paggamit ng SRO macron/circumflex para sa Cree, mga diacritical mark para sa Inuktitut, mga vowel length marker para sa Ojibwe. Mga set ng panuntunan bawat wika. |

> **Ang idinadagdag ng mga structural metric, at kung bakit diagnostic ang mga ito.** Ang OMT-1600 ng Meta — ang pinakamalaking MT system na nai-publish kailanman (1,600 wika; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026) — ay nagsusuri gamit ang ChrF++, xCOMET, MetricX, at BLASER 3. Wala sa mga ito ang nagpapatunay ng kawastuhang morpolohikal: sinusukat ng chrF++ ang overlap ng character n-gram at binibigyang-pabuya ang mga string na *kamukha* ng reference, kaya ang isang salitang hindi wasto ayon sa morpolohiya ngunit kapareho ng maraming character sa reference ay nakakakuha pa rin ng kredito. Sinasagot ng FST acceptance ang ibang tanong: ang bawat salita ba ay wastong anyo sa wika? Ginagawa nitong kapaki-pakinabang na diagnostic para sa mga polysynthetic na wika. Hindi ito translation score: hindi nito kailanman tinitingnan ang pinagmulan o ang reference, kaya ang isang sistemang nagpi-print ng isang wastong pangungusap para sa bawat input ay ganap na pumapasa rito (ibinibigay ng §4 ang nasukat na kaso). Mayroon ding **nonzero chance floor** ang chrF++ na nag-iiba-iba ayon sa ortograpiya — ang random na teksto sa parehong script ay kapansin-pansing nakakakuha ng markang higit sa zero, mas mataas sa ilang sistema ng pagsulat kaysa sa iba — kaya hindi maihahambing ang raw chrF++ sa iba't ibang wika; nagraranggo lamang ito ng mga sistema sa parehong evaluation set. Samakatuwid, ang network map ay **hindi** nagraranggo ng lakas sa iba't ibang wika kailanman — ang isang arc ay nangangahulugang nasukat na ang pares, wala nang iba pa. Ang pagwawasto sa chance-floor na binuo namin para dito (cchrF++) ay nai-publish na pananaliksik at hindi nakakabit sa anumang pampublikong interface; ipinapaliwanag ng [Connection Strength](/docs/network/specifications/connection-strength) kung ano ang naitatatag nito at kung ano ang hindi.

### 2.3 Semantic Metrics

Sinusukat ng semantic metrics ang preservation ng kahulugan gamit ang embeddings o learned models. Nahuhuli ng mga ito ang translations na surface-different ngunit meaning-equivalent, at fina-flag ang translations na surface-similar ngunit semantically wrong.

| ID | Sukatan | Katayuan | Iskala | Antas | Pagpapatupad |
|----|--------|--------|-------|-------|---------------|
| `semantic_score` | Semantic Similarity | ⚡ Bahagya | 0.0–1.0 | Pareho | **Diagnostic.** CRK: verdict-weighted score mula sa `CrkSemanticMetric` ng pamantayan sa pagsusuri ng CRK (sa `eval_standards/crk/`, proxy). Pangkalahatan: cosine similarity ng mga sentence embedding (source + predicted vs source + reference). Modelo ay tutukuyin pa (TBD) — dapat sumuporta sa mga low-resource na wika, na nag-aalis sa karamihan ng mga English-centric embedding model. |
| `comet_score` | COMET | ✅ Naipatupad | ~0.0–1.0 | Pareho | **Karaniwang sukatan kapag nakalkula, ipinapakita sa tabi ng chrF++ kalakip ang model id nito** (`comet_model`). Learned MT evaluation metric (Rei et al. 2020). Hindi kailanman inihahalo sa chrF++. Muling kinakalkula ng verifier, kaya dapat ma-reproduce ang iniulat na halaga. Minarkahan ng low-resource calibration caveat para sa mga wika tulad ng Plains Cree. Kinakalkula kapag naka-install ang `unbabel-comet`. Para sa 35 wikang Aprikano, awtomatikong pinipili ng harness ang AfriCOMET (`masakhane/africomet-mtl`) sa pamamagitan ng `resolve_comet_model()`, na may mas mahusay na human-judgment correlation para sa mga wikang iyon. |

> **Bakit katabi ng headline ang COMET, at hindi ang mismong headline.** Sinanay ang COMET sa data ng human-evaluation ng WMT, na halos puro high-resource European na pares. Para sa mga totoong high-resource na pares (German, French, …), ang default na `Unbabel/wmt22-comet-da` ay napatunayang mabuti ng WMT, at pinipili ito ng `resolve_comet_model()`. Kapag inilapat sa Plains Cree o iba pang LRL, nag-e-extrapolate ang modelo mula sa mga wikang may magkakaibang morphological system — kapaki-pakinabang ang direksyon ngunit hindi naka-calibrate, at sinasabi ito ng card. Nangangailangan din ito ng 2.3 GB na modelo, kaya hindi ito kinakalkula para sa bawat run. Ang chrF++ ay maaaring ma-reproduce mula sa corpus lamang para sa bawat wika, kung kaya't ito ang headline at iniuulat ang COMET sa tabi nito tuwing nakalkula ito.

> **AfriCOMET para sa African languages.** Bawat language card ay may `metricModelSupport` field (tingnan ang language card spec §9) na nagdedeklara kung aling specialized COMET models ang trained para sa wikang iyon. Para sa 35 African languages (yor, hau, ibo, amh, swa, atbp.), idinedeklara ng card ang AfriCOMET (`masakhane/africomet-mtl`) — isang COMET model na fine-tuned sa African language MT human judgments ng Masakhane community. Auto-select ng harness ang recommended model sa pamamagitan ng `resolve_comet_model()` na nagbabasa mula sa language cards, ngunit maaari itong i-override gamit ang `--comet-model`. Ginagawa ang pagdagdag ng bagong language→model mappings sa pamamagitan ng pagpapayaman ng language card (hindi pag-edit ng Python code).

### 2.4 Behavioral Metrics

Natutukoy ng mga behavioral metric ang mga partikular na failure mode sa output ng pagsasalin. Hindi direktang sinusukat ng mga ito ang kalidad — nagtutukoy ang mga ito ng mga problema. Lahat ng mga ito ay mga **diagnostic**.

| ID | Sukatan | Katayuan | Iskala | Antas | Pagpapatupad |
|----|--------|--------|-------|-------|---------------|
| `code_switching_rate` | Code-Switching Rate | ✅ Naipatupad | 0.0–1.0 (mas mababa ay mas mainam) | Pareho | Bahagi ng mga salita sa output na nasa source language (karaniwang Ingles). Natutukoy sa pamamagitan ng Unicode script analysis at/o listahan ng mga salita sa source language. Napakakaraniwang failure mode ng LLM: nagsisingit ang modelo ng mga salitang Ingles kapag hindi nito alam ang katumbas sa target na wika. |
| `hallucination_rate` | Hallucination Rate | ✅ Naipatupad | 0.0–1.0 (mas mababa ay mas mainam) | Pareho | Bahagi ng nilalaman ng output na walang katumbas na nilalaman sa source. Natutukoy sa pamamagitan ng word alignment o cross-lingual embedding overlap. Nahuhuli nito ang pagbuo ng modelo ng mga mukhang kapani-paniwala ngunit gawa-gawang salin. |
| `terminology_adherence` | Terminology Adherence | ✅ Naipatupad | 0.0–1.0 | Pareho | Para sa mga pamamaraang may coaching: bahagi ng itinakdang termino ng terminolohiya na lumalabas sa output. Nangangailangan ng talasalitaan (glossary) (`{"source term": "translation"}`, o isang listahan ng mga tinatanggap na salin bawat termino). Ang pinagmulan ay `--glossary <file.json>`, isang input sa pagsusuri na hindi kailanman ipinapadala sa modelo at ibinibigay sa bawat run na inihahambing. Kung hindi, ito ang `dictionary` object ng isang JSON `--coaching-file`: binibigyang-puntos ang run laban sa sarili nitong coaching, at sinasabi ito ng run output. Kung wala ang alinman, hindi aktibo (null) ang sukatan. Sinusukat kung iginagalang ng modelo ang bokabularyong ibinigay ng eksperto. |
| `consistency_score` | Cross-Entry Consistency | 🔲 Nakaplano | 0.0–1.0 | Corpus lamang | Isinasalin ba ng modelo ang parehong termino ng source sa parehong paraan sa iba't ibang entry? Ang mababang consistency ay nagpapahiwatig na nanghuhula ang modelo sa halip na maglapat ng mga natutunang pattern. Nangangailangan ng mga inuulit na termino sa mga entry ng corpus. |

### 2.5 Compliance Metrics

Pinapatunayan ng mga compliance metric na napapanatili ng mga salin ang structural integrity — mga placeholder, pag-format, at mga kumbensyon sa tipograpiya. Ang mga ito ay mga quality-gate check, hindi mga score ng kalidad, at mga diagnostic sa ilalim ng pamantayan.

| ID | Sukatan | Katayuan | Iskala | Antas | Pagpapatupad |
|----|--------|--------|-------|-------|---------------|
| `compliance_index` | Double-Pass Compliance | 🔲 Nakaplano | 0.0–1.0 | Pareho | Weighted composite: 60% integridad ng variable (napanatili ba ang mga `{placeholder}` var?) + 20% pagsunod sa panipi (mga quote character ng target na wika) + 20% pagsunod sa casing (walang pagtagas ng titik Latin para sa mga wikang walang case). Kinakalkula sa parehong raw at post-processed na output. Umiiral ang isang class na `DoublePassCompliancePlugin`, ngunit walang evaluation run ang naglo-load nito, at wala pang binanggit na sanggunian para sa mga kumbensyon sa panipi at casing bawat wika. Walang dalang ganoon ang mga language card. Kung wala ang sangguniang iyon, ang bahagi lamang ng variable-integrity ang may nasusukat. |
| `repair_effectiveness` | Repair Effectiveness | 🔲 Nakaplano | 0.0–1.0 | Corpus | Bahagi ng mga paglabag sa compliance na awtomatikong naayos ng mga post-translation hook. Sinusukat kung gaano napahusay ng quality gate ang raw output. Nakaplano sa parehong dahilan gaya ng `compliance_index`. |

> **Bakit isang gate ang compliance, at hindi score.** Sinusukat ng mga compliance metric ang structural preservation (mga placeholder, panipi), hindi ang kalidad ng pagsasalin. Ang isang salin ay maaaring perpekto ayon sa linggwistika ngunit bumagsak sa compliance dahil naiwala nito ang isang `{name}` variable. Idinisenyo ang mga ito bilang mga quality gate, upang harangan ang pagpapadala ng masamang output, hindi upang magranggo ng kalidad ng pagsasalin.

### 2.6 Mga iniulat na comparator

Ang spBLEU ay isa sa mga karaniwang sukatang ipinapakita sa tabi ng chrF++; ang payak na chrF at ang comparator na estilong-FUSE ay iniuulat para sa paghahambing sa iba pang nai-publish na talahanayan. Wala sa mga ito ang inihahalo sa anupaman:

| ID | Sukatan | Katayuan | Mga Tala |
|----|--------|--------|-------|
| `spbleu` | spBLEU (FLORES-200 tokenizer) | ✅ Naipatupad | **Karaniwang sukatan, ipinapakita sa tabi ng chrF++** (`scores.spbleu`, kalakip ang sacreBLEU signature nito). BLEU sa SentencePiece tokenization ng FLORES-200 (Goyal et al. 2022) — maihahambing sa iba't ibang script/segmentation (ang lingua-franca ng NLLB/FLORES). Nangangailangan ng `sentencepiece` (core dep). |
| `chrf_plain` | Payak na chrF (`word_order=0`) | ✅ Naipatupad | Ang bilang ng chrF na iniuulat ng AmericasNLP at ng maraming talahanayan ng WMT, kasabay ng aming chrF++ headline (`word_order=2`). Ang signature nito ay `sacrebleu_signatures.chrf_plain`. |
| `fuse_score` | FUSE-style comparator | ⚡ Opt-in (`--fuse`) | Isang **HINDI SINANAY na muling pagpapatupad** ng pamamaraang FUSE ng AmericasNLP-2025 (Raja & Vats): LaBSE semantic + lexical token-F1 + phonetic Soundex + fuzzy difflib, na pinaghalo bilang isang *unweighted mean* (wala kaming training data ng paghuhusga ng tao upang i-fit ang orihinal na Ridge/GBM, at sinasabi namin ito). Ang LaBSE/Soundex ay ang opsyonal na `fuse` extra; kung walang LaBSE, nagbabalik ang `compute_fuse` ng `None` (isinisiwalat) sa halip na gumawa ng pekeng puntos. Ang bawat bahaging tumakbo ay nakalista sa `fuse_components`; ang resulta ay minarkahan ng `fuse_untrained=true`. Isang diagnostic comparator lamang. |

### 2.7 Metric Namespaces {#2-7-metric-namespaces}

Ang iisang metric ay may hanggang apat na coordinated names sa buong stack: ang
**canonical id** (ang `scores` key sa run card, hal. `equivalent_match_rate`),
ang Python **plugin name** na kumukuwenta nito (hal. `crk_linter`), ang language-card
**`evalMetrics` key** na nagdedeklara nito (hal. `lyss-eq`), at ang denormalized
**`run_cards` column** sa leaderboard (hal. `equivalent_match_rate`). Sadyang
magkakaiba ang mga ito — ipinapahayag ng plugin name ang *tool*, ipinapahayag ng metric id ang
*measurement* — ngunit dapat manatili silang naka-lockstep.

Ang nag-iisang mapagkukunan ng katotohanan para sa pagmamapang iyon ay ang `shared/metric-registry.json`, na inilo-load
ng `mt_eval_harness.metric_manifest`. Itinatala ng bawat entry ang apat na pangalan kasama ang `scale`,
`direction` (mas mataas/mas mababa/neutral), `level` (entry/corpus/pareho), `in_composite`
(kung ito ay nasa itinigil na composite; pinananatili para sa pag-verify ng mga lumang card), at
`verifier_reproducible`. Babagsak ang isang parity test kung ang mga talahanayan ng `scoring.py` o ang
mga run-card `scores` key na ginawa ng `publish.py` ay lumihis mula sa registry, kaya hindi maaaring
maipadala ang isang bagong sukatan na kalahati lamang ang pagkakakabit.

Ginagawang explicit ng dalawang kaugnay na run-card fields ang metric provenance:

- **`scores.metric_availability`** — isang `{metric: reason}` block na naglilinaw sa
  `null` na puntos: `not_applicable` (hindi ito ginagamit ng wika/run), `unavailable`
  (nawawala ang isang opsyonal na dependency), `below_coverage_floor` (naroroon ngunit masyadong
  kaunti upang maging higit pa sa advisory), `not_run` (opt-in at hindi hiniling), o
  `not_implemented` (nakaplano). Ang isang sukatang wala sa block ay normal na nakalkula.
- **`fst_version`** / **`fst_provenance`** — ang naka-install na release ng GiellaLT transducer
  at bersyon ng `pyhfst` sa likod ng anumang sukatang hango sa FST, na kinuha sa parehong paraan
  gaya ng mga sacreBLEU signature upang ang isang structural score ay matunton sa eksaktong
  analyzer build. Isinasaad ng `fst_provenance.acceptance_method` kung paano kinalkula ang acceptance
  mula sa mga sagot ng transducer (`case-fallback/1`, §1); ang isang card na wala
  nito ay minarkahan nang case-sensitively.
- **`scores.sacrebleu_signatures`** — ang sacreBLEU signature ng bawat
  sacreBLEU metric na kinakalkula ng run: `chrf` (ang chrF++ headline,
  `word_order=2`), `chrf_plain`, `bleu`, `spbleu`, `ter`. Ang dalawang numero ng chrF++ ay
  maihahambing lamang kapag magkatugma ang mga signature ng mga ito (Post 2018).

### 2.8 Mga Score Caveat {#2-8-score-caveats}

Ang isang puntos ay maaaring makalkula nang tama at hindi pa rin nangangahulugan ang sinasabi ng label nito.
Sinusuri ng harness ang bawat run para sa mga kilalang sitwasyon kung saan nangyayari iyon at, kapag may nag-trigger,
inililimbag ito sa tabi ng headline sa buod ng pagsubok, `mt-eval compare`, ang
publish preview at ang dashboard, at dinadala ito ng nai-publish na card bilang
`score_caveats` upang ipakita rin ito ng leaderboard. Hindi kailanman binabago ng caveat ang isang puntos;
sinasabi nito kung ano ang naglilimita rito. Bawat isa ay isang diagnostic na may `severity` (`major` o
`minor`) at isang isang-pangungusap na mensahe na nagsasaad ng mga bilang, hindi kailanman ang mismong
mga output.

| Caveat | Nag-ti-trigger kapag |
|--------|----------------------|
| `source_copy` | Hindi bababa sa kalahati ng mga namarkahang output ay katumbas ng pinagmulan ng mga ito (hindi pinapansin ang case, mga accent at bantas). Ang isang entry na ang reference ay mismong pinagmulan (isang pangalan, isang numero) ay hindi isinasama. |
| `length_deflation` | Ang mga output ay may average na mas mababa sa 0.5× ng haba ng reference, o sangkapat o higit pa sa mga ito ay ganoon — may mga salitang naiwan. Hinuhusgahan lamang ng FST acceptance at code-switching ang mga salitang naroroon, kaya ang pag-aalis ng mga salita ay nagpapataas sa mga ito. |
| `length_inflation` | Ang mga output ay may average na higit sa 2× ng haba ng reference, o sangkapat o higit pa sa mga ito ay ganoon (halimbawa, tumatagas ang mga few-shot example sa bawat output). |
| `near_constant_output` | Isang output ang ibinibigay para sa maraming iba't ibang input: sumasaklaw ang mga pag-uulit sa hindi bababa sa sangkapat ng mga natatanging source, at hindi bababa sa 5 sa mga ito. Binibilang ang isang output bilang pag-uulit kapag 3 source ang nakakuha nito (isang output na may tatlo o higit pang salita) o 5 (isang output na may isa o dalawang salita, dahil ang mga maikling sagot tulad ng "Oo." ay lehitimong umuulit); ang isang output na katumbas ng sarili nitong reference ay isang tamang sagot, hindi isang pag-uulit. Bago piliin ang mga limitasyong iyon, pinatakbo ang panuntunan sa 2,161 totoong output at reference ng system mula sa mga gawain sa sukatan ng WMT 2019–2025; ang limang na-flag nito ay pawang sira na output. |
| `train_test_near_twin` | Isinulat ng nmt-forge: bawat (o halos bawat) row ng pagsubok ay may halos magkaparehong kakambal sa data ng pagsasanay, kaya sinusukat ng puntos ang recall ng mga parirala sa pagsasanay, hindi ang pagsasalin. |

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

## 4. Itinigil na: ang Composite (legacy) {#4-composite-score}

> [!CAUTION]
> **Walang bagong run ang binibigyang-puntos gamit ang composite.** Itinigil na ito ng pamantayan sa pagmamarka na `standard/1` ([Paano binibigyang-puntos ang mga run](#how-runs-are-scored)). Ang mga bagong card ay nagpa-publish ng `composite: null`. Pinananatili ang seksyong ito **para lamang** mabasa at ma-verify pa rin ang mga card na na-publish bago ang pamantayan: muling kinakalkula ng verifier ang nakaimbak na composite ng anumang card na walang dalang `scores.scoring_standard`, gamit ang eksaktong formula at mga talahanayan sa ibaba. Saanman ipinapakita pa rin ang composite ng lumang card, ito ay may label na **legacy composite (itinigil na)**, at hindi ito kailanman inihahambing sa chrF++ o sa isang bagong card.

### Bakit ito itinigil {#why-the-composite-was-retired}

Ang composite ay isang weighted blend ng chrF++/100, exact match, FST acceptance (weight 0.25), morphological accuracy, ang semantic score, code-switching, hallucination at terminology, na may mga timbang na itinakda ayon sa engineering judgment at hindi kailanman iniakma sa mga paghuhusga ng tao. Dahil ilan sa mga input nito ay hindi kailanman naghahambing ng output sa source o sa reference, maaaring makuha ng isang sistema ang karamihan nito nang hindi nagsasalin:

- **Isang pangungusap para sa bawat input.** Ang isang hindi sinanay na modelong English→Northern Sámi na nag-ulit ng isang wastong pangungusap sa Northern Sámi para sa bawat input ay nakakuha ng composite na **0.6244** — may label na "functional" — na may **chrF++ 5.5**. Ang mga inulit na salita ay wastong Sámi, kaya ang FST acceptance ay 100%, at para sa isang wikang ang FST ay isang spell-checking acceptor, nagdala ang FST acceptance ng halos 45% ng composite kapag na-re-weight na ang mga nawawalang sukatan.
- **Pag-aalis sa hindi kayang isalin.** Ang isang simpleng talasalitaan na nag-iiwan sa bawat salitang hindi nito alam ay nakakuha ng **0.6612**, dahil ang FST acceptance at code-switching ay humuhusga lamang sa mga salitang nilalaman ng isang output.
- **Pagkopya sa pinagmulan.** Ang Ingles na kinopya nang walang pagbabago bilang "Northern Sámi" output ay nakakuha pa rin ng FST credit, dahil tumatanggap ang isang speller ng mga naka-capitalize at ilang salitang Ingles.

Walang karaniwang pagsusuri ang magraranggo sa mga sistemang ito nang mas mataas kaysa sa isang totoong salin, at hindi ito ginagawa ng chrF++: inihahambing nito ang bawat output sa reference nito. Nahuhuli rin ng mga caveat ng harness (§2.8) ang mga pattern na ito, at nananatiling kapansin-pansin sa tabi ng chrF++ headline.

### 4.1 Formula (legacy)

Ang composite score ay isang weighted average ng lahat ng *magagamit* na sukatan, na muling na-normalize upang ang kabuuan ng mga timbang ng mga magagamit na sukatan ay maging 1.0:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

Ang isang sukatan ay "magagamit" kung ang halaga nito sa run card ay isang numero (hindi `null`). Kapag hindi magagamit ang isang sukatan — dahil walang FST ang wika, o dahil hindi pa naipapatupad ang isang sukatan — muling ipinamamahagi ang timbang nito nang proporsyonal sa mga natitirang sukatan. Ang mga composite na kinakalkula mula sa magkakaibang set ng sukatan ay hindi kailanman maihahambing; itinatala ng bawat legacy card ang `scores.scoring_profile` at `scores.metric_availability` nito (§2.7), kaya alam ng verifier kung aling set ang gagamitin.

### 4.2 Pag-normalize ng Input (legacy)

Bago pumasok sa formula ng composite, ang bawat sukatan ay inilagay sa isang **0.0–1.0 na iskala** kung saan ang 1.0 = perpekto:

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

### 4.3 Mga Talahanayan ng Timbang (legacy) {#43-weight-tables}

Bawat wika ay nareresolba sa isang **pinangalanang profile** sa pamamagitan ng `language_cards.resolve_scoring_profile()` (`fst-coverage` kapag nagmarka ang isang FST sa run, kung hindi ay `surface-only`, maliban kung nagdeklara ang language card ng `scoringProfile.basis`); sinasalamin ang profile sa `PROFILE_REGISTRY` ng `scoring.py` at nakatala sa bawat legacy card bilang `scores.scoring_profile`. Nakalista ang `orthographic_accuracy` sa `scoring.INACTIVE_METRICS` at hindi kailanman kinakalkula, kaya laging muling ipinamamahagi ang timbang nito. Pumasok lamang ang `morphological_accuracy` kapag `morph_coverage ≥ 0.25`. Ang mga neural metric (`comet_score`, `qe_score`; `scoring.NEURAL_METRICS`) ay hindi kailanman napabilang sa anumang composite.

#### `fst-coverage` (Profile A): Mga Wikang MAY FST Coverage

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

> **Kabuuan: 1.00.** Kapag wala ang `morphological_accuracy` (walang FST analyzer, isang acceptor-only na FST, o saklaw na mas mababa sa 0.25), ang natitirang 8 sukatan (kabuuan 0.85) ay bawat isa na-scale ng 1/0.85 ≈ 1.176. Para sa isang wikang may acceptor-only na FST (Northern Sámi, Amharic, Basque) na walang pamantayan sa pagsusuri at walang glossary, ang FST acceptance 0.25, chrF++ 0.15, code-switching, hallucination at exact match (0.05 bawat isa) lamang ang natira — kabuuang 0.55 — kaya dinala ng FST acceptance ang **0.25/0.55 ≈ 45%** ng composite. Iyon ang timbang na sinamantala ng mga halimbawa sa itaas.

#### `surface-only` (Profile B): Mga Wikang WALANG FST Coverage

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

> **Kabuuan: 1.00.** Hindi kailanman kinakalkula ang `orthographic_accuracy`, kaya ang natitirang 7 sukatan (kabuuan 0.95) ay na-scale ng 1/0.95 ≈ 1.053.

#### `no-reference`: runs na WALANG gold reference

| Metric | Target Weight | Rationale |
|--------|---------------|-----------|
| `fst_acceptance_rate` | **0.40** | Hindi nangangailangan ng reference ang morphological validity; ito ang pinakamalakas na deterministic signal kapag may FST. |
| `code_switching_rate` | **0.25** | Source-language leakage (inverted). |
| `hallucination_rate` | **0.20** | Fabricated content (inverted). |
| `terminology_adherence` | **0.15** | Coached vocabulary compliance. |

> **Kabuuan: 1.00.** Para sa mga run na ang corpus ay walang mga gold reference. Kapag ang naturang run ay walang FST, muling nag-normalize ang composite sa mga behavioral check lamang.

### 4.4 Pagdaragdag ng Bagong Sukatan

Idinaragdag ang isang bagong sukatan bilang isang **diagnostic**; hindi nito kailanman binabago ang headline:

1. **Tukuyin ito** sa §2 na may katayuang `🔲 Planned`, kabilang ang iskala, antas, direksyon, at paraan ng kalkulasyon.
2. **Ipatupad ito** bilang isang MetricPlugin (o sa `tester.py` para sa mga core metric).
3. **Irehistro ito** sa `shared/metric-registry.json` at magdagdag ng null placeholder sa block ng mga score ng run card.
4. **I-update ang BENCHMARK_SPEC.md** §3 kung magbago ang schema ng run card.
5. **Magpatakbo ng validation benchmark** upang kumpirmahing gumagawa ang sukatan ng mga makatwirang halaga sa totoong data.
6. **I-update ang dokumentong ito** upang baguhin ang katayuan mula `🔲` patungong `✅`.

Ang pagbabago sa headline o ranking metric ay hindi "pagdaragdag ng sukatan": nangangailangan ito ng bagong bersyon ng pamantayan sa pagmamarka ([Paano binibigyang-puntos ang mga run](#how-runs-are-scored)).

---

## 5. Itinigil na: Mga Quality Tier (legacy) {#5-quality-tiers}

> [!CAUTION]
> **Walang bagong card ang may dalang quality tier.** Ang mga bagong card ay nagpa-publish ng `quality_tier: null`, at walang bagong output ang nagpi-print ng tier o label tulad ng "functional" o "deployable". Ang awtomatikong puntos ay hindi hatol sa kalidad: magkaiba ang kahulugan ng parehong numero para sa iba't ibang wika at evaluation set, at binansagan ng mga itinigil na tier ang isang sistemang nag-uulit ng isang pangungusap para sa bawat input bilang "functional" (§4). Tanging human evaluation lamang ng mga tagapagsalita ang nagpapatunay sa kalidad ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

Ang mga tier ay mga label na binasa mula sa legacy composite. Iniimbak pa rin ng mga legacy card ang mga ito; pinananatili ang mga ito rito para lamang mabasa ang isang lumang card, at hindi mga pahayag ukol sa kalidad.

| Legacy tier | Saklaw ng legacy composite |
|-------------|----------------------------|
| Baseline | 0.00–0.30 |
| Emerging | 0.30–0.50 |
| Functional | 0.50–0.70 |
| Deployable | 0.70–0.85 |
| Fluent | 0.85–1.00 |

### 5.1 Mga Limitasyon ng Tier (Machine-Readable, legacy)

Ang mga legacy threshold (sinusuri mula itaas pababa, unang tumugma ang mananalo):

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

Sinusukat ng mga sukatan ng gastos ang kahusayan sa pananalapi ng isang paraan ng pagsasalin. Iniuulat ang mga ito sa tabi ng puntos at hindi kailanman pinagsasama rito.

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

### 6.3 Cost-Adjusted Score (itinigil na)

May dalang cost-adjusted score ang mga legacy card, na kinakalkula mula sa itinigil na composite:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

Itinigil na ito kasabay ng composite: ang mga bagong card ay nagpa-publish ng `cost_adjusted: null`. Upang timbangin ang gastos laban sa kalidad, basahin nang magkatabi ang chrF++ (kalakip ang CI nito) at `cost_per_entry_usd`; maaaring mag-uri-uri ang leaderboard ayon sa alinman.

---

## 7. Speed Metrics

Sinusukat ng mga sukatan ng bilis ang latency at throughput ng isang paraan ng pagsasalin. Tulad ng gastos, iniuulat ang bilis sa tabi ng puntos at hindi kailanman isinasama rito.

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

### 8.1 Mga Bootstrap Confidence Interval

Ang mga confidence interval ay mga percentile bootstrap interval sa mga segment ng evaluation set (n=1000 resamples, α=0.05; Koehn 2004). Ang chrF++ interval ay bahagi ng headline: `chrF++ 47.5 [45.9, 49.0]`. Sa isang maliit na evaluation set, malawak ang interval, at nagbabala ang harness kapag napakaliit ng subset para sa isang makabuluhang interval.

| Sukatan | Iniulat ang CI |
|---------|----------------|
| `chrf_plus_plus` (headline) | ✅ run card `confidence_intervals.corpus_chrf`; database `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (kinakalkula lamang kapag mayroong FST data) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (naka-bootstrap mula sa mga naka-cache na score bawat entry — walang redundant na neural inference) |
| `composite` | Mga legacy card lamang (`composite_ci_lower`, `composite_ci_upper`); hindi kinakalkula para sa mga bagong run |
| mga CI bawat tier | ✅ `confidence_intervals_by_tier` — mga CI ng chrF++ at exact_match bawat antas ng kahirapan (Tier 1-5) |

### 8.2 Mga Paired Significance Test {#82-paired-significance-tests}

Kung mas mahusay ang isang run kaysa sa isa pa ay pinagpapasyahan sa pamamagitan ng isang paired significance test sa chrF++ sa mga segment na parehong isinalin ng dalawang run, hindi kailanman sa pamamagitan ng paghahambing ng dalawang numero. Nagpapatakbo ang `mt-eval compare --significance` ng:

- **Approximate randomization** (ang default; Riezler & Maxwell 2005, default din ng sacreBLEU): ang mga output ng dalawang sistema ay ipinagpapalit-palit segment por segment nang random, 1,000 beses, upang makita kung gaano kadalas lumilitaw nang nagkataon lamang ang isang pagkakaibang kasinglaki man lang nito.
- **Paired bootstrap resampling** (`--method paired_bootstrap`; Koehn 2004): muling sinasampol ang mga segment nang may kapalit at muling kinakalkula ang pagkakaiba sa bawat sample. Isa itong mas konserbatibong pagtatantya, na iniaalok para sa paghahambing sa mga mas lumang papel.

```
H₀: The two methods perform equally on this evaluation set.
H₁: One method is better.
```

Bawat pagkakaiba ay may kasamang 95% confidence interval nito at iniuulat bilang makabuluhan kapag p < 0.05. Ang BLEU, spBLEU, TER at ang mga diagnostic na naroroon sa parehong run ay sinusuri at ipinapakita rin (ang mga p-value ay bawat sukatan at hindi itinatama para sa maramihang pagsusuri), ngunit ang hatol sa "mas mahusay" ay ang chrF++ test. Ang dalawang numero ng chrF++ ay maihahambing lamang kapag nagtutugma ang mga sacreBLEU signature ng mga ito. Kung ang isa sa mga inihambing na ulat ay isang legacy, sinasabi ng paghahambing na itinigil na ang composite nito at hindi ito inihahambing. Buong paraan: [Statistical Significance Testing](/docs/network/specifications/significance).

---

## 9. Run Card Scores Schema

Tinutukoy ng seksyong ito ang hierarchical structure ng `scores` block sa isang run card. Ang schema na ito ay hinango mula sa metrics na tinutukoy sa §2–§7 at dapat panatilihing naka-sync.

```jsonc
{
  "scores": {
    // The scoring standard
    "scoring_standard":       "standard/1", // absent on legacy cards → "legacy-composite"
    "primary_metric":         "chrf_plus_plus",

    // HEADLINE (§2.1): corpus chrF++, 0–100; CI in confidence_intervals.corpus_chrf,
    // signature in sacrebleu_signatures.chrf
    "chrf_plus_plus":         47.52,

    // Other standard metrics — shown beside chrF++, never blended
    // (BLEU rides at the card's top level as "corpus_bleu"; COMET below)
    "spbleu":                 24.01,        // FLORES-200 SentencePiece BLEU
    "ter":                    61.2,         // 0–∞ (lower=better)
    "chrf_plain":             44.10,        // plain chrF (word_order=0), for comparison with published tables
    "sacrebleu_signatures": {
      "chrf":   "nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.4.3",
      "bleu":   "nrefs:1|case:mixed|eff:no|tok:13a|smooth:exp|version:2.4.3"
      // also chrf_plain, spbleu, ter
    },

    // Diagnostics (§2) — reported separately, never in a headline
    "exact_match_rate":       0.1613,       // 0.0–1.0
    "exact_matches":          10,           // count
    "equivalent_match_rate":  null,         // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     null,
    "length_ratio":           1.03,         // ideal=1.0
    "fst_acceptance_rate":    0.92,         // 0.0–1.0
    "fst_accepted":           274,          // count
    "morphological_accuracy": 0.63,         // FST-derived, lemma-matched, verifier-re-derived
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     false,        // legacy key; always false on a standard/1 card
    "orthographic_accuracy":  null,         // 🔲 planned
    "semantic_score":         null,         // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "code_switching_rate":    0.03,         // lower=better
    "hallucination_rate":     0.01,         // lower=better
    "terminology_adherence":  null,         // null when no glossary
    "style_consistency_rate": null,         // writing style
    "consistency_score":      null,         // 🔲 planned

    // COMET — a standard metric when computed (model id beside it)
    "comet_score":            0.712,        // null when not computed
    "comet_model":            "Unbabel/wmt22-comet-da",

    // Retired (§4, §5, §6.3) — always null on a standard/1 card
    "composite":              null,
    "quality_tier":           null,
    "cost_adjusted":          null,

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "corpus_chrf":        { "ci_lower": 45.9, "ci_upper": 49.0 },   // the headline's CI
      "exact_match_rate":   { "ci_lower": 0.08, "ci_upper": 0.25 },
      "corpus_comet":       { "ci_lower": 0.69, "ci_upper": 0.73 }
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

Ang mga score caveat (§2.8) ay nakalagay sa pinaka-itaas na antas ng card bilang `score_caveats`, isang listahan ng mga `{kind, source, severity, message, …}` object; ang BLEU ay nakalagay doon bilang `corpus_bleu`.

> **Schema history.** Nagmungkahi ang mas naunang spec drafts ng hiwalay na `cost`, `speed`, at `tokens` blocks. Pinagsama ang mga ito sa `scores` at `totals` respectively para sa simplicity. Ang speed metrics (`tokens_per_second`, `entries_per_minute`, latencies) ay nasa `scores`; ang token counts at cost figures ay nasa `totals`.

### 9.1 Schema–Database Mapping

Ini-store nang buo ang run card JSON bilang `jsonb` column sa Supabase. Ang key metrics ay denormalized din sa top-level columns para sa sort/filter performance:

| Field sa Run Card | Column sa Supabase | Uri | Index |
|-------------------|--------------------|-----|-------|
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.confidence_intervals.corpus_chrf` | `chrf_ci_lower`, `chrf_ci_upper` | `real` | — |
| `scores.composite` | `composite_score` | `real` | `idx_composite` — mga legacy card lamang; null para sa `standard/1` |
| `scores.quality_tier` | `quality_tier` | `text` | — mga legacy card lamang; null para sa `standard/1` |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `corpus_bleu` | `corpus_bleu` | `real` | — |
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
| *(buong card)* | `run_card` | `jsonb` | — |

Kapag may bagong metrics na implemented, dapat idagdag ang corresponding column sa pamamagitan ng numbered migration sa `arena/migrations/`.

---

## 10. Code–Spec Synchronization

### 10.1 Canonical Source

Ang dokumentong ito ang canonical source para sa:
- Ang pamantayan sa pagmamarka: ang headline metric, ang mga karaniwang sukatan sa tabi nito, at ang mga diagnostic ([Paano binibigyang-puntos ang mga run](#how-runs-are-scored))
- Mga kahulugan ng sukatan (§2) at mga score caveat (§2.8)
- Ang mga legacy composite weight table (§4.3) at mga limitasyon ng tier (§5.1), na pinananatili para sa pag-verify ng mga lumang card
- Mga formula ng sukatan ng gastos (§6.2)
- Schema ng mga score ng run card (§9)

### 10.2 Code Mirror

Ang file na `arena/mt_eval_harness/scoring.py` ay ang code implementation ng dokumentong ito: ang mga metric role ng pamantayan (`SCORING_STANDARD`, `PRIMARY_METRIC`, `SECONDARY_METRICS`, `DIAGNOSTIC_METRICS`) at, sa ilalim ng mga ito, ang mga legacy composite table at tier threshold na ginagamit lamang upang i-verify ang mga lumang card. Walang ibang module ang tumutukoy sa mga ito; pinipirmi ng mga pagsusuri ng harness ang pareho. Kapag na-update ang dokumentong ito, i-update ang `scoring.py` upang tumugma at muling patakbuhin ang mga pagsusuri ng harness.

### 10.3 Mga Dokumentong Nagre-reference sa Spec na Ito

| Dokumento | Ang Isinasangguni Nito | Paano Panatilihing Naka-sync |
|-----------|------------------------|------------------------------|
| [Benchmark Specification](/docs/network/specifications/benchmark) §4–§5 | Ang headline metric, ranking, legacy composite | I-cross-reference ang doc na ito; huwag kopyahin ang mga talahanayan |
| [Statistical Significance Testing](/docs/network/specifications/significance) | Paano pinagpapasyahan ang "mas mahusay" | Dapat tumugma sa §8.2 |
| [FAQ](/docs/network/getting-started/faq) at [Paano Ito Gumagana](/docs/network/how-it-works) | Buod ng pamantayan sa payak na wika | Mag-link pabalik sa doc na ito |
| `publish.py` sa pamamagitan ng `scoring.py` | `standard_score_fields()` at ang legacy composite | Pinapatunayan ng mga test ng harness ang pagtutugma |

---

## Apendise A: Bakit chrF++ ang Headline (at Hindi ang Iba Pa)

| Sukatan | Papel | Bakit |
|---------|-------|-------|
| **chrF++** | Headline | Nagbibigay ang character n-grams ng bahagyang kredito para sa isang salitang may tamang ugat at ibang hulapi, kaya mas nakakayanan nito ang mayamang morpolohiya kaysa sa mga word-level metric (Popović 2015, 2017). Nabe-reproduce ito mula sa corpus lamang para sa bawat wika at script, at ito ang iniuulat ng FLORES-200 at ng mga shared task ng AmericasNLP. |
| **BLEU** | Karaniwan, katabi | Binibilang ng word-level matching ang isang maliit na pagkakaiba sa inflection bilang ganap na pagkakamali, na nagpaparusa sa mga wikang polysynthetic. Iniuulat para sa paghahambing sa panitikan ng MT. |
| **spBLEU** | Karaniwan, katabi | BLEU sa isang pinagsasaluhang SentencePiece tokenization, na maihahambing sa iba't ibang script; iniuulat ng FLORES-200. |
| **TER** | Karaniwan, katabi | Edit distance; may korelasyon sa chrF++ para sa karamihan ng mga sitwasyon ng paggamit. |
| **COMET** | Karaniwan, katabi (kapag nakalkula) | Sinanay sa data ng WMT (mga high-resource European na pares). Para sa mga LRL (hal. Cree), nag-e-extrapolate ang modelo at hindi naka-calibrate, at nangangailangan ito ng malaking modelo, kaya hindi ito maaaring maging nag-iisang numero na mayroon ang bawat run. Muling kinakalkula ng verifier. |
| **Length Ratio** | Diagnostic | Ang ratio na 1.02 at ang ratio na 0.98 ay parehong maayos. Mga labis na halaga lamang ang nagpapahiwatig ng mga problema (§2.8). |
| **FST acceptance, morphological accuracy, LYSS** | Diagnostic | Mga engineering heuristic na walang data ng ugnayan sa tao; hindi kailanman tinitingnan ng FST acceptance ang pinagmulan o reference (§4). |
| **Consistency Score** | Diagnostic (nakaplano) | Lehitimo ang ilang hindi pagkakatugma (parehong salitang Ingles → iba't ibang salin sa target na wika depende sa konteksto). |
| **Compliance Index** | Gate (nakaplano) | Sinusukat ang pagpapanatili ng estruktura (mga placeholder, panipi), hindi ang katumpakan ng pagsasalin. |

## Apendise B: LYSS — Mga Pagpapatupad ng Sukatang Partikular sa Wika

Ang **LYSS** framework (Linguistically-informed Yield & Structural Scoring) ay nagbibigay ng language-specific metrics na lumalampas sa surface-level string comparison. May tatlong core components ang LYSS:

- **LYSS-fst** — Morphological validity (`fst_acceptance_rate`): Valid form ba sa target language ang bawat word?
- **LYSS-eq** — Linguistic equivalence (`equivalent_match_rate`): Katanggap-tanggap na variant ba ng reference ang output?
- **LYSS-sem** — Semantic validation (`semantic_score`): Napapanatili ba ng output ang source meaning?

Lahat ng tatlo ay mga **diagnostic** sa ilalim ng pamantayan sa pagmamarka: iniuulat sa tabi ng chrF++ headline, hindi kailanman sa loob nito.

> **Validation status: 🔶 Engineering heuristic.** HINDI pa na-validate ang LYSS metrics laban sa human quality judgments. Dinisenyo ang mga ito mula sa linguistic principles (FSTs, dictionaries, grammar rules na binuo ng linguists sa UAlberta ALTLab), ngunit hindi pa nasusukat ang correlation sa pagitan ng LYSS scores at aktuwal na translation quality. Tingnan ang [Speaker Validation Protocol](/docs/network/specifications/speaker-validation) para sa kinakailangang validation experiments.

| Wika | Plugin | Lokasyon | Bahagi ng LYSS | Metric Key | Mga Tala |
|------|--------|----------|----------------|------------|----------|
| CRK (Plains Cree) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | Mga panuntunan sa deterministic variant-class: ayos ng salita, ortograpiko, opsyonal na particle, kasingkahulugan ng lemma, progressive ambiguity, inclusive/exclusive. Gumagawa ng `lint_verdict` bawat entry (EXACT/EQUIVALENT/MISS/NO_OUTPUT). |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | Deterministic: pagkuha ng lemma sa FST + mga gloss ng diksiyonaryo + spaCy content-word overlap. Gumagawa ng mga hatol (EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT). |
| Mga wika ng GiellaLT | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | Generic: anumang wikang may FST na naka-pin sa harness (`mt_eval_harness/data/fst-pins.json`). Nagbibigay din ang isang analyzer FST ng `morphological_accuracy`; ang isang acceptor-only na speller (ang mga package ng Divvun na naka-pin para sa Northern Sámi, Amharic at Basque) ay nag-uulat lamang ng acceptance. Ang pagiging namarkahan ng FST sa praktika ay nangangailangan din ng isang evaluation set para sa pares na maaaring magranggo: ang dalawang set ng Plains Cree (EdTeKLA) ay mga naka-quarantine na label na tinatanggihan ng database na bigyan ng marka, habang ang ilang iba pang wika ng FST ay may mga bukas na set (Tatoeba, WMT, WMT24++). Inililista ng [pahina ng mga dataset](/docs/network/leaderboard/datasets) ang katalogo, at inililista ng `mt-eval corpora --source eng --target <code>` kung ano ang maaaring tumakbo para sa isang pares (tingnan ang [Mga Tapat na Limitasyon](/docs/network/honest-limitations)). |

> **Tala sa arkitektura (Hunyo 2026).** Ang mga sukatang LYSS na partikular sa wika ay idinedeklara na ngayon sa language card sa ilalim ng `evalMetrics` at inilo-load mula sa `eval_standards/<lang>/` ng `plugin_discovery.py`. Ang mga ito ay mga **evaluation standard** (referee), hindi mga metric ng plugin ng pamamaraan (contestant). Nangangahulugan ito na ang anumang pamamaraan ng pagsasalin na nakatutok sa CRK ay awtomatikong sinusuri ng mga LYSS diagnostic — walang kinakailangang configuration na partikular sa pamamaraan. Inalis ang `CrkFSTMetric`; ganap na saklaw ang functionality nito ng generic na `GiellaLTFSTMetric`.

## Apendise C: Mga Sukatang Isinasaalang-alang

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

1a. Popović, M. (2015). "chrF: character n-gram F-score for automatic MT evaluation." *Proceedings of the Tenth Workshop on Statistical Machine Translation (WMT 2015)*. Lisbon, Portugal.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. Belgium, Brussels. Reference implementation: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

### Kasanayan sa Pagsusuri at Pagsusuri ng Pagiging Makabuluhan (Significance Testing)

S1. Koehn, P. (2004). "Statistical Significance Tests for Machine Translation Evaluation." *Proceedings of the 2004 Conference on Empirical Methods in Natural Language Processing (EMNLP 2004)*. Barcelona, Spain.

S2. Riezler, S. & Maxwell, J. T. (2005). "On Some Pitfalls in Automatic Evaluation and Significance Testing for MT." *Proceedings of the ACL Workshop on Intrinsic and Extrinsic Evaluation Measures for Machine Translation and/or Summarization*. Ann Arbor, MI.

S3. Kocmi, T., Federmann, C., Grundkiewicz, R., Junczys-Dowmunt, M., Matsushita, H., & Menezes, A. (2021). "To Ship or Not to Ship: An Extensive Evaluation of Automatic Metrics for Machine Translation." *Proceedings of the Sixth Conference on Machine Translation (WMT 2021)*.

S4. Kocmi, T., et al. (2024). "Findings of the WMT24 General Machine Translation Shared Task." *Proceedings of the Ninth Conference on Machine Translation (WMT 2024)*.

S5. NLLB Team, Costa-jussà, M. R., et al. (2022). "No Language Left Behind: Scaling Human-Centered Machine Translation." arXiv:2207.04672. (FLORES-200; nag-uulat ng chrF++ at spBLEU.)

S6. Goyal, N., Gao, C., Chaudhary, V., et al. (2022). "The Flores-101 Evaluation Benchmark for Low-Resource and Multilingual Machine Translation." *Transactions of the Association for Computational Linguistics*, vol. 10. (spBLEU.)

S7. Mager, M., Oncevay, A., Ebrahimi, A., et al. (2021). "Findings of the AmericasNLP 2021 Shared Task on Open Machine Translation for Indigenous Languages of the Americas." *Proceedings of the First Workshop on Natural Language Processing for Indigenous Languages of the Americas*.

S8. Ebrahimi, A., Mager, M., Rijhwani, S., et al. (2023). "Findings of the AmericasNLP 2023 Shared Task on Machine Translation into Indigenous Languages." *Proceedings of the Workshop on Natural Language Processing for Indigenous Languages of the Americas (AmericasNLP 2023)*.

### Neural Metrics

5. Rei, R., Stewart, C., Farinha, A. C., & Lavie, A. (2020). "COMET: A Neural Framework for MT Evaluation." *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP 2020)*, pp. 2685–2702. Online.

6. Juraska, J., Finkelstein, M., Deutsch, D., Siddhant, A., Mirzazadeh, M., & Freitag, M. (2023). "MetricX-23: The Google Submission to the WMT 2023 Metrics Shared Task." *Proceedings of the Eighth Conference on Machine Translation (WMT 2023)*, Singapore. (ACL Anthology 2023.wmt-1.63)

7. Zhang, T., Kishore, V., Wu, F., Weinberger, K. Q., & Artzi, Y. (2020). "BERTScore: Evaluating Text Generation with BERT." *Proceedings of the Eighth International Conference on Learning Representations (ICLR 2020)*. Addis Ababa, Ethiopia.

8. Sellam, T., Das, D., & Parikh, A. (2020). "BLEURT: Learning Robust Metrics for Text Generation." *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics (ACL 2020)*, pp. 7881–7892. Online.

### Mga Kasangkapang Morpolohikal at Linggwistiko

9. Lindén, K., Silfverberg, M., Axelson, E., Hardwick, S., & Pirinen, T. (2011). "HFST—Framework for Compiling and Applying Morphologies." *Systems and Frameworks for Computational Morphology (SFCM 2011)*, Communications in Computer and Information Science, vol. 100, pp. 67–85. Springer, Berlin, Heidelberg.

10. Sánchez-Cartagena, V. M., & Toral, A. (2024). "MorphEval: Automatic Evaluation of Morphological Capabilities of Machine Translation Systems." *Machine Translation*, vol. 38, pp. 1–28.

### Pag-uuri ng Error at Pagsusuring Diagnostic

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
