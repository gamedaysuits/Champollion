---
sidebar_position: 6
title: "Espesipikasyon ng Pagiging Maaasahan ng Metric"
slug: '/network/specifications/metric-reliability'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What each metric measures and how the harness computes it"
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
---

# Espesipikasyon ng Pagiging Maaasahan ng Metric

> **Executive Summary.** Ang score ng benchmark ay kasingkahulugan lamang ng metric
> sa likod nito — at ang mga automatic metric ay hindi pantay-pantay na umaayon sa
> human judgment sa iba't ibang wika. Tinutukoy ng dokumentong ito kung paano sinusukat ng Champollion ang
> **metric reliability**: para sa bawat language family, kung gaano kalakas ang ugnayan ng bawat automatic
> metric (BLEU, spBLEU, chrF, chrF++, COMET, MetricX) sa mga human
> quality judgment, na kinuwenta mula sa WMT Metrics shared-task archives
> (2019–2025). Ang output ay isang nailathala at machine-readable na evidence artifact
> na kinokonsulta ng harness, CLI, at MCP server bago ipakita ang anumang
> score bilang mapagkakatiwalaan. Sa aming kaalaman, walang ibang evaluation infrastructure ang
> naglalathala ng ganitong ebidensiya bawat wika; ito ang nagbabago sa "nagpatakbo kami ng metric"
> tungo sa "ito ang antas kung gaano ito dapat paniwalaan."
>
> **Scope.** Tinutukoy ng dokumentong ito kung *ano ang reliability evidence, saan ito
> nagmumula, eksakto kung paano ito kinukuwenta, at ano ang sinasadya nitong hindi isama*.
> Ang mismong mga depinisyon ng metric ay nasa
> [Scoring Specification](/docs/network/specifications/scoring); ang statistical
> testing ng mga pagkakaiba sa score ay nasa
> [Significance](/docs/network/specifications/significance). Ang importer na
> muling lumilikha ng artifact ay `arena/scripts/import_wmt_metaeval.py` sa
> harness repository — ang code ang huling sanggunian sa implementation detail,
> at bukas ito para sa pagsusuri.

---

## 1. Ang problemang nilulutas nito

Ang kalidad ng machine translation ay, sa huli, isang human judgment. Umiiral ang mga automatic
metric dahil mabagal at magastos ang human evaluation; bawat automatic
score ay isang *proxy* para sa sasabihin ng isang may-kakayahang bilingual. Tahimik na ipinagpapalagay ng buong
larangan sa shorthand nito — "Tinalo ng System A ang System B ng 2 BLEU" —
na tapat ang proxy.

Sinusubok na ang palagay na iyon sa loob ng maraming taon ng WMT Metrics shared task, ngunit
halos palaging *bilang aggregate*: niraranggo ang mga metric ayon sa average correlation sa
human judgment sa lahat ng language pair na saklaw ng campaign sa taong iyon —
karamihan ay high-resource na European pairs kasama ang Chinese at Japanese. Umiiral ang per-language
detail sa raw data at sa per-year findings papers, ngunit hindi ito
nailalathala saanman bilang queryable, per-language-family evidence layer na maaaring
konsultahin ng evaluation pipeline.

Napakahalaga ng detalyeng ito para sa low-resource at morphologically rich
languages. Ipinapakita ng dalawang finding mula sa sarili naming import ang nakataya
(nasa §7 ang buong table):

- **English→Inuktitut (wmt20).** Ang system-level correlation ng BLEU sa human
  judgment ay **+0.16** — halos walang impormasyong naibibigay. Umaabot ang chrF sa +0.35.
  Umaabot ang COMET sa +0.86. Ang leaderboard na niraranggo ayon sa BLEU para sa pair na ito ay
  magraranggo ng ingay; ang parehong leaderboard na niraranggo ayon sa COMET ay may dalang signal.
- **English→Maasai (wmt25).** Ang kabaligtarang pagkabigo: ang correlation ng MetricX-25
  ay **−0.09** — isang state-of-the-art na *learned* metric na nagsi-score ng wikang
  wala sa training nito ay nagbibigay ng mga numerong walang ugnayan sa human judgment,
  habang ang computed chrF++ (isang "dumb" string metric na walang training data na
  maaaring kulangin) ay umaabot sa +0.50.

Hindi nakikita ang alinmang failure mode sa global average, at tumuturo sila sa
magkasalungat na direksiyon: para sa isang wika, ang learned metric ang tanging magagamit;
para sa isa pa, ito ang tanging *hindi magagamit*. Anumang infrastructure na
nagsi-score ng daan-daang language pair gamit ang fixed metric suite — gaya ng ginagawa ng Champollion —
ay may obligasyong ibigay sa mga user nito ang ebidensiyang ito.

## 2. Mga depinisyon

Ang mga depinisyon sa ibaba ang minimum na kailangan upang basahin nang tumpak ang natitirang bahagi ng
dokumento. Maaaring dumiretso sa §3 ang mga mambabasang pamilyar sa MT evaluation.

**Automatic metric.** Isang function mula sa (system output, reference translation,
at minsan ang source) patungo sa isang numero. Ang *String metrics* — BLEU, spBLEU,
chrF, chrF++ — ay naghahambing ng surface overlap sa pagitan ng output at reference.
Ang *Learned metrics* — COMET, MetricX, BLEURT — ay mga neural model na sinanay sa
nakaraang human judgments upang hulaan ang kalidad. Ang canonical identifiers para sa lahat ng
metric sa dokumentong ito ay nagmumula sa metric registry ng Champollion
(`shared/metric-registry.json`): `bleu`, `spbleu`, `chrf_plain`,
`chrf_plus_plus`, `comet_score`, `metricx_score`.

**Human judgment protocols.** Nangolekta ang WMT campaigns ng human quality
scores sa ilalim ng ilang protocol, na pinananatiling magkahiwalay ng artifact na ito:

- **DA (Direct Assessment)** — nire-rate ng crowdworkers o researchers ang isang
  translation mula 0–100. Ang *z-normalized* DA (isinusulat na `wmt-z`) ay nag-i-standardize ng scores ng bawat
  rater sa mean 0, variance 1, upang alisin ang mga epekto ng rater-generosity.
- **DA+SQM** (`da-sqm`, `wmt`) — DA na kinolekta sa 0–100 scale na annotated
  gamit ang scalar quality metric anchor descriptions; ginamit mula WMT22.
- **MQM (Multidimensional Quality Metrics)** (`mqm`) — minamarkahan at kino-classify ng professional
  annotators ang mga indibiduwal na error span ayon sa severity; ang
  weighted error count ay nagiging segment score. Mabagal, magastos, at ang
  pinakapinagkakatiwalaang signal na available; kinolekta lamang para sa iilang high-resource
  pair bawat taon (ang annotations ay nagmula sa
  `wmt-mqm-human-evaluation` releases ng Google).
- **ESA (Error Span Annotation)** (`esa`, `esa-merged`) — protocol ng WMT24 at
  WMT25 na pinagsasama ang error-span marking sa scalar rating;
  mas mura kaysa MQM, mas informative kaysa DA.

**Meta-evaluation.** Pagsusuri sa mga tagasuri: pagsukat kung gaano kahusay
umaayon ang scores ng bawat automatic metric sa human scores sa parehong
translations. Sinusukat ang agreement sa dalawang level:

- **System level** (`sys`): bawat MT system ay may isang aggregate human score
  at isang aggregate metric score para sa test set; kinukuwenta ang agreement
  sa lahat ng system. Itinatanong nito: *iniraranggo ba ng metric ang buong systems sa paraang
  ginagawa ng mga tao?* — ang tanong na mahalaga sa leaderboard.
- **Segment level** (`seg`): agreement sa mga indibiduwal na (system, sentence)
  pair. Itinatanong nito: *masasabi ba ng metric kung mabuti o masama ang isang sentence?* —
  ang tanong na mahalaga sa quality estimation at data filtering. Mas
  mahirap ito, at sistematikong mas mababa ang correlations.

**Correlation statistics.** Apat na standard statistics, na eksaktong tinutukoy dito
ayon sa pagkakakuwenta:

- **Pearson's r** — linear correlation sa pagitan ng dalawang score vector.
- **Spearman's ρ** — Pearson's r na kinuwenta sa average ranks; sumusukat ng
  monotonic agreement, hindi sensitibo sa scale.
- **Kendall's τ-b** — sa lahat ng pares ng item, ang (tie-adjusted) excess
  ng concordantly ordered pairs kaysa discordantly ordered ones. Ginagamit namin ang
  standard tie-adjusted τ-b formulation (katumbas ng `scipy.stats.kendalltau`;
  ang aming implementation ay dependency-free at cross-checked laban sa isang
  brute-force reference sa test suite).
- **Pairwise ranking accuracy** (system level only) — sa lahat ng pares ng system
  na *strictly* ino-order ng mga tao, ang fraction na ino-order ng metric sa parehong
  paraan, kung saan ang metric tie ay binibilang bilang kabiguang kopyahin ang order. Ito
  ang accuracy statistic nina Kocmi et al. (2021), na ginagamit ng kamakailang WMT
  campaigns bilang kanilang headline system-level number.

**Language family.** Ang genealogical grouping ng *target* language
(ang wikang pinagsasalinan), gaya ng naitala sa language
database ng Champollion (`languages.family`, derived from Glottolog). Tinatalakay ng §5 kung bakit ang
target side, at kung ano ang kaya at hindi kayang i-proxy ng family.

## 3. Data

### 3.1 Sources, pinned

| Source | Ibinibigay nito | Pin |
|---|---|---|
| `google-research/mt-metrics-eval` (data archive v2) | Human scores, metric scores, system outputs, sources, at references para sa bawat WMT Metrics-task test set, wmt19–wmt25 | code commit `68a481ae…`; data tarball `mt-metrics-eval-v2.tgz` mula sa `data.statmt.org`, pinned **sha256 `6708eec9aaa8a9deca5e370bdd0e23db4881aeca129f29d5281575eaa66c7e10`**, ETag `36579a46-64ff8bb1d3080`, Last-Modified 2026-04-21, 911,710,790 bytes |
| `google/wmt-mqm-human-evaluation` | Ang upstream origin ng MQM expert annotations na nire-redistribute ng mt-metrics-eval sa merged form; Apache-2.0 | commit `7fadea28…` |

Dalawang data-integrity fact ang humuhubog sa pinning discipline. Una, **hindi immutable ang data
tarball** — nire-republish ito in place habang nadaragdagan ang campaigns —
kaya itinatala ng artifact ang checksum, ETag, at timestamp ng
eksaktong kopya kung saan kinuwenta ang mga numero, at tumatanggi ang importer na tumakbo
nang walang checksum. Ikalawa, saklaw ng Apache-2.0 grant ng toolkit ang *code* nito;
**walang explicit license statement ang kasamang human-judgment at test-set data**.
Ang mga kahihinatnan nito ay nasa §8.

Ang archive contents (≈4.2 GB uncompressed: human judgments, references,
at full system outputs para sa bawat campaign) ay **hindi kailanman ini-store sa
repositoryong ito o nire-redistribute ng Champollion**. Kinukuha ang mga ito mula sa source
papunta sa local cache; tanging derived correlation numbers ang inilalathala. Ito ang
parehong fetch-from-source posture na sinusunod ng bawat Champollion benchmark.

### 3.2 Ano ang ambag ng bawat campaign

| Test set | Pairs na may human judgments | Human protocol(s) na ginamit dito |
|---|---|---|
| wmt19 | 18 | DA-z |
| wmt20 | 18 (incl. en→iu, en→ta, km→en, ps→en) | DA-z; MQM (en→de, zh→en) |
| wmt21.news | 16 (incl. en→ha, en→is) | DA-z; MQM (en→de, zh→en, en→ru) |
| wmt21.tedtalks | 3 | MQM |
| wmt21.flores | 4 (bn↔hi, xh↔zu) | DA-z |
| wmt22 | 17 (incl. en→liv, sah→ru, cs↔uk) | DA-SQM; MQM (en→de, zh→en, en→ru) |
| wmt23 | 9 (incl. he→en) | DA-SQM; MQM |
| wmt23.sent | 1 | MQM |
| wmt24 | 11 (incl. en→is, en→hi) | ESA; MQM |
| wmt25 | 16 (incl. en→bho, en→mas, en→ar) | ESA-merged; MQM |

**Hindi kasama: wmt24pp.** Pinalalawak ng WMT24++ release ang coverage sa 55 language
pairs ngunit naglalaman lamang ng *references at system outputs* — walang human judgments —
kaya walang correlation na maaaring kuwentahin mula rito. Nakalista ito sa exclusion ledger ng artifact
sa halip na tahimik na alisin.

## 4. Method

Nilalakad ng importer ang bawat (test set, language pair) at kumukuwenta ng isang
**cell** bawat (human-judgment lane, level, metric):

1. **Tuklasin ang human lanes.** Lahat ng available human score files para sa pair
   ay itinutugma sa isang explicit allowlist (§4.1). Wala sa scope ang rater-level files,
   raw error-span files, at document/domain-level scores.
2. **Ibukod ang human "systems."** Kasama sa WMT score files ang reference
   translations mismo bilang scored systems (`refA`, `refb`, `HUMAN.0`…).
   Walang saysay ang pag-correlate ng metric laban sa sarili nitong reference, kaya anumang
   system na tumutugma sa reference set ng pair o sa prefixes na
   `ref`/`human`/`synthetic` ay ibinubukod sa kabuuan.
3. **I-align.** System level: ang intersection ng systems na may parehong
   human at metric score (ang missing values ay dini-drop, hindi kailanman kino-coerce sa
   zero). Segment level: bawat (system, segment) na may parehong scores, pooled
   sa lahat ng system nang walang grouping — ito ang "no
   averaging" flattening ng mt-metrics-eval. Ang ragged files (mismatched segment counts) ay nagfa-fail sa
   cell sa halip na i-align nang tinatayang paraan.
4. **Kuwentahin.** Pearson, Spearman, at Kendall τ-b sa parehong level; pairwise
   ranking accuracy sa system level. Ang cells na may mas kaunti sa 3 aligned
   systems (sys) o mas kaunti sa 10 aligned points sa hindi bababa sa 2 systems
   (seg), o may zero variance sa alinmang side, ay itinatala sa
   exclusion ledger bilang degenerate (20 cells sa kasalukuyang build).
5. **I-roll up.** Bawat target-language family, bawat metric, bawat level: ang
   n-weighted mean ng bawat statistic sa mga *preferred* cells (§4.1),
   pinananatili ang listahan ng nag-ambag na (test set, pair) upang anumang aggregate
   ay maaaring i-decompose pabalik sa inputs nito.

### 4.1 Human-lane preference

Kapag may ilang human-judgment lanes ang isang pair, kinukuwenta ang lahat, ngunit eksaktong
isa ang naka-flag bilang **preferred** at tanging preferred cells lamang ang pumapasok sa family
roll-up — kung hindi, bibilang nang dalawang beses ang isang pair na hinusgahan sa ilalim ng parehong MQM at DA.
Ang preference order ay ayon sa signal quality:

```
mqm > esa-merged > esa > da-sqm > wmt-z > wmt-appraise-z > wmt-appraise > wmt > wmt-raw
```

Nangunguna ang expert error annotation (MQM) kaysa error-span protocols (ESA), na
nangunguna naman kaysa scalar direct assessment; sa loob ng DA, nangunguna ang z-normalized lanes kaysa raw
ones. Nananatili sa artifact ang non-preferred cells para sa sinumang nais
pag-aralan ang protocol effects.

### 4.2 Metric identity at versioning

Nagbabago taon-taon ang learned metrics (magkakaibang models ang COMET-20, COMET-22, MetricX-23/24/25),
at ang pagtrato sa mga ito bilang iisang metric ay magpapalabo mismo sa
distinction na dahilan kung bakit umiiral ang meta-evaluation. Kaya itinatala ng bawat cell
ang **verbatim upstream score name** (`COMET-22`, `MetricX-25-Ref`,
`metricx_xxl_MQM_2020`…) kasabay ng canonical registry id, at inililista ng
artifact kung aling upstream names ang nagpakain sa bawat id. Kapag nagsi-score ang campaign ng
metric laban sa ilang reference, itinatala rin bawat cell ang reference stream na ginamit.

Ginagamit ang scores eksakto kung paano ipinamahagi ng archive ang mga ito (lahat ng lanes
higher-is-better; ang MQM error scores at MetricX ay naka-store nang negated upstream).
Walang sign flipping o rescaling na inilalapat; invariant ang correlations sa
scale at empirically na-verify ang orientation convention bago ang import.

### 4.3 Ang computed chrF++ lane

Ang chrF++ — ang primary string metric ng harness — ay naisumite lamang sa
wmt20 campaign, kaya umiiral ang upstream scores para sa isang taon. Para sa bawat ibang test
set, kinukuwenta mismo ng importer ang chrF++ (sacreBLEU, `word_order=2`) mula sa
cached system outputs laban sa recorded reference. Ang cells na ito ay
naka-flag na `computed: true` at gayon din ang sinasabi ng upstream name nito: ang
Champollion-computed score ay hindi kailanman ipinapakita bilang WMT submission. Lahat ng iba pang
metric cells ay verbatim upstream values; ang tanging idinadagdag ng Champollion
sa mga ito ay ang correlation arithmetic.

## 5. Mga design choice, alternatibo, at rationale

Ito ang mga desisyong dapat siyasatin ng reviewer. Bawat isa ay naglilista kung ano ang
pinili, ano ang hindi, at bakit.

**Keyed by target-language family.** *Pinili:* mag-aggregate ayon sa family ng
wikang pinagsasalinan *into*. *Mga alternatibo:* per-pair lamang (walang
aggregation); source-side o pair-level typology; typological feature
vectors sa halip na genealogy. *Rationale:* ang metric reliability ay higit na pinangingibabawan
ng kung gaano kahirap i-score ang *output* language — pinalalaki ng morphological richness
ang surface mismatch para sa string metrics, at pinapahina ng training-data scarcity
ang learned metrics — parehong katangian ng target. Ang family ay isang magaspang
ngunit universally available na key (mayroon nito ang bawat wika sa database ng Champollion);
magiging mas fine-grained ang typological features ngunit kulang o
pinagtatalunan ang mga ito para mismo sa low-resource languages kung saan umiiral ito. Ganap na pinananatili ang
per-pair cells, kaya maaaring bumuo ng mas pinong re-aggregations (by genus, by
morphological type) mula sa artifact nang hindi muling nag-i-import.

**Flattened segment-level correlation.** *Pinili:* Kendall τ-b sa
pooled (system, segment) vector. *Mga alternatibo:* item-grouped pairwise
accuracy na may tie calibration (ang acc*-eq ng kamakailang WMT findings);
per-segment τ averaged sa lahat ng segment. *Rationale:* ang flattened
statistic ang pinakasimpleng defensible choice, eksaktong nare-reproduce mula sa
depinisyon nito nang walang tie-calibration procedure, at pinapanatili ang
cross-language comparability na kailangan ng artifact na ito. *Hindi* ito ang pinakabagong
WMT headline statistic, at inililista iyon ng §8 bilang limitation sa halip na
magpanggap na katumbas.

**Ang metric ties ay binibilang laban sa metric** sa pairwise accuracy. Ang metric
na hindi kayang paghiwalayin ang dalawang system na pinaghihiwalay ng mga tao ay nabigong kopyahin
ang human ordering; ang pagbibigay ng half credit ay magbibigay-gantimpala sa score quantization.

**Weighted means sa roll-up.** Tinitimbang ng family aggregates ang bawat cell ayon sa
sample size nito (systems sa sys level, points sa seg level), kaya ang
17-system MQM pair ay mas mabigat kaysa 6-system DA pair. Nananatiling
available ang unweighted per-cell values.

**Thresholds.** Kailangan ng cells ng ≥3 aligned systems (walang kahulugan ang correlation sa 2 points)
o ≥10 aligned segment points sa ≥2 systems. Mga floor ito laban sa
degenerate arithmetic, hindi significance claims — §8.

**Verbatim-upstream discipline.** Walang muling kinukuwenta ang Champollion kung maaari
itong i-cite (maliban sa flagged chrF++ lane), dahil ang re-scored learned metrics
ay magpapasok ng version at environment drift na pinipigilan ng per-cell upstream
names. Ang trade-off — coverage gaps kung hindi nagpatakbo ng metric ang isang campaign —
ay nakikita bilang missing cells sa halip na takpan.

**Fail-honest exclusions.** Lahat ng nalaktawan (test set na walang human
judgments, hindi maresolbang language code, degenerate cell) ay isinusulat sa
exclusion ledger na may dahilan. Maaaring ilista ng mambabasa ng artifact
kung ano ang *wala* rito — ang property na wala sa karamihan ng aggregate reports.

## 6. Ang published artifact

Ang evidence ay inilalabas bilang isang machine-readable JSON file, na sinusubaybayan sa
monorepo (sadyang hindi isinasama sa npm/PyPI packages):

```
shared/catalogue/metric-reliability.json    # the artifact (≈0.6 MB)
shared/schemas/metric-reliability.schema.json  # its JSON-Schema contract
```

Kasalukuyang build: **1,810 cells** (1,052 preferred) sa **57 language pairs**,
**10 test sets**, **11 target families**, na may 21 ledger exclusions. Top-level
blocks: pinned `sources` at `provenance` (bawat derived value ay may
`champollion-derived` provenance na nagpapangalan sa upstreams — amin ang correlations,
hindi amin ang judgments); `correlation_definitions` (ang eksaktong statistic
definitions ng §2); `metrics` (registry id ↔ upstream names); `languages`
(code → family/genus); `families` (ang roll-up); `cells` (bawat correlation,
ganap na attributed); `excluded` (ang ledger).

Tatlong consumer surface ang bumabasa nito ngayon:

- **Harness CLI:** `mt-eval recommend SRC TGT` nagre-render ng "metric trust for
  the target" block kasabay ng method availability at cited results.
- **Champollion CLI:** `champollion recommend SRC TGT` (parehong payload
  contract; monorepo-tracked ang artifact, kaya ang packaged installs ay nagde-degrade
  tungo sa explicit na "index not available" note).
- **MCP server:** ang `get_metric_reliability` tool ay sumasagot sa "which metric
  should I trust for language X?" para sa anumang connected AI agent, kabilang ang
  explicit na UNMEASURED answer para sa mga wikang hindi pa nahuhusgahan ng anumang WMT campaign.

## 7. Results overview

System-level Pearson correlation sa preferred human lane, weighted
mean bawat target family (kasalukuyang build; ang segment-level numbers, Spearman, τ-b
at pairwise accuracy ay nasa artifact):

| Target family | Pairs | BLEU | spBLEU | chrF | chrF++ | COMET | MetricX |
|---|---|---|---|---|---|---|---|
| Afro-Asiatic | 2 | +0.88 | +0.95 | +0.85 | +0.87 | +0.67 | **−0.62** |
| Dravidian | 1 | +0.88 | — | +0.94 | +0.93 | +0.94 | — |
| Eskimo-Aleut | 1 | **+0.16** | — | +0.35 | +0.33 | **+0.86** | — |
| Indo-European | 42 | +0.75 | +0.76 | +0.79 | +0.76 | +0.81 | +0.84 |
| Japonic | 1 | +0.52 | +0.89 | +0.93 | +0.84 | +0.73 | +0.74 |
| Koreanic | 1 | +0.89 | +0.87 | +0.87 | +0.88 | +0.55 | +0.77 |
| Niger-Congo | 2 | +0.94 | — | +1.00 | +1.00 | +1.00 | — |
| Nilotic | 1 | — | — | — | +0.50 | — | **−0.09** |
| Sino-Tibetan | 2 | +0.49 | +0.68 | +0.68 | +0.62 | +0.72 | +0.82 |
| Turkic | 1 | +0.85 | — | +0.97 | +0.97 | — | — |
| Uralic | 3 | +0.85 | +0.88 | +0.91 | +0.91 | +0.75 | +0.81 |

Paano ito basahin — at paano hindi:

- **Tumutugma ang broad pattern sa aggregate findings ng larangan.** Sa
  42-pair Indo-European bulk, nangunguna ang learned metrics (MetricX +0.84, COMET
  +0.81) kasunod ang chrF at huli ang BLEU — ang standard WMT result,
  na nare-reproduce dito mula sa raw data bilang sanity anchor.
- **Ang per-family deviations ang payload.** Para sa polysynthetic
  Inuktitut, bumabagsak ang string metrics at COMET lamang ang usable signal.
  Para sa Maasai at para sa English→Arabic sa wmt25, *negatively* nagko-correlate ang MetricX
  habang nananatiling serviceable ang string metrics — isang learned metric na nag-e-extrapolate
  lampas sa training distribution nito ang tahimik na nabibigo, na may mukhang confident na
  scores. Ito mismo ang mga kasong binubura ng global average.
- **Ang single-pair families ay ebidensiya, hindi conclusions.** Walo sa labing-isang
  families ay nakabatay sa isa o dalawang pair mula sa iisang campaign. Ang matapat na
  pagbasa ng "Eskimo-Aleut: BLEU +0.16" ay *"sa iisang campaign kung saan
  hinusgahan ng mga tao ang en→iu, walang naibigay na impormasyon ang BLEU"* — isang dokumentadong measurement,
  isang red flag, at isang dahilan para mangolekta pa, hindi batas tungkol sa family.
- **Hindi ibig sabihin ng negative cell na sira ang metric saanman.** Ibig
  sabihin nito: sa pair na iyon, sa system pool ng campaign na iyon, in-order ng metric ang
  systems laban sa human judgment. Maaaring pababain ng range restriction (tingnan ang §8)
  ang anumang correlation kapag mahigpit na magkakalapit ang kalidad ng systems.

## 8. Limitations

Malinaw na sinasabi, dahil ang halaga ng artifact ay ang katapatan nito:

1. **Ang family ay proxy, hindi mechanism.** Nauugnay ang genealogical family
   sa, ngunit hindi nito tinutukoy, ang morphological properties na nagtutulak sa
   metric behaviour. Pinapayagan ng per-pair cells (na may genus na naitala bawat wika)
   ang mas pinong slicing; ang family key ay isang queryable default, hindi claim
   ng typological causality.
2. **Ang coverage ay kung ano ang hinusgahan ng WMT, hindi kung ano ang sinasalita ng mundo.** 57 pairs,
   heavily Europe-weighted; bawat xx→English pair ay pumapasok sa Indo-European;
   ang buong macro-families (Algonquian, Austronesian, Quechuan, …) ay *walang
   human-judgment coverage kahit ano*. Para sa mga iyon, sumasagot ang surfaces ng Champollion ng
   UNMEASURED sa halip na manghiram ng numero ng kapitbahay. Ang sariling
   sovereign-benchmark program ng Champollion — community-controlled test sets na may native
   speaker validation — ang pangmatagalang solusyon para mismo sa gap na ito.
3. **Ang within-family transfer ay assumption.** Kapag ang queried language ay
   hindi pa direktang nahusgahan, ang family-level evidence ay nagmumula sa *ibang* wika
   sa family, at tahasang sinasabi iyon ng bawat consuming surface.
4. **Wala pang confidence intervals.** May sample sizes ang cells ngunit walang
   bootstrap intervals; lalo na ang single-pair family aggregates ay dapat
   basahin kasama ng mga lapad na ipinahihiwatig ng §7. Planned work ang pagdaragdag ng per-cell bootstrap CIs (mayroon na ang
   harness ng machinery para sa score CIs).
5. **Range restriction.** Kinukuwenta ang correlations sa mga submitted system ng bawat campaign.
   Maraming malalakas na system sa kamakailang campaigns ang mahigpit na magkakalapit
   sa kalidad, na nagpapababa ng correlations para sa lahat ng metrics — bahagi ng dahilan kung bakit
   nagpapakita ng extreme values ang wmt25-derived cells (Maasai, Arabic). Ang
   per-testset attribution sa bawat cell ay nagpapanatili nitong inspectable.
6. **Segment-level statistic choice.** Simple at reproducible ang flattened τ-b
   ngunit hindi ito ang tie-calibrated grouped accuracy ng pinakakamakailang WMT findings papers; ang mga numero rito ay hindi dapat ihambing nang digit
   -for-digit laban sa mga publikasyong iyon.
7. **Data license.** Walang explicit
   license statement ang upstream human-judgment data (§3.1). Walang nire-redistribute ang Champollion na alinman dito, naglalathala
   lamang ito ng derived statistics na may full attribution, at pinapanatili ang artifact na ito sa
   isang **non-commercial evidence lane** (`license_lane.commercial_ok: false`)
   hanggang maresolba ang posture. Ang MQM lanes ay karagdagan ding nagta-trace sa
   Apache-2.0 annotation releases ng Google.
8. **Moving target ang archive.** Idinaragdag ang bagong campaigns sa parehong
   tarball URL. Eksaktong tinutukoy ng pins ang aming snapshot; ang regeneration laban
   sa mas bagong snapshot ay isang bagong artifact version na may bagong pins, hindi kailanman silent
   update.

## 9. Reproduction

Maaaring muling likhain ang artifact mula sa source ng sinuman:

```bash
# 1. Fetch the archive (912 MB compressed; NOT immutable — keep the pins)
mkdir -p ~/.mt-eval/mt-metrics-eval && cd ~/.mt-eval/mt-metrics-eval
curl -sSL -D mt-metrics-eval-v2.headers -o mt-metrics-eval-v2.tgz \
     https://data.statmt.org/wmt26/mt-metrics-eval-v2.tgz
shasum -a 256 mt-metrics-eval-v2.tgz > mt-metrics-eval-v2.sha256
tar xzf mt-metrics-eval-v2.tgz

# 2. Regenerate (refuses to run without a checksum pin)
python3 arena/scripts/import_wmt_metaeval.py
```

Tandaan na ang sariling README ng archive ay tumuturo sa retiradong storage.googleapis.com
URL; `data.statmt.org` ang live host. Pure Python
standard library ang importer (sacreBLEU lamang para sa computed chrF++ lane); ang
correlation implementations nito ay cross-checked laban sa brute-force references
sa `arena/tests/test_wmt_metaeval.py`, at ang structural
contract ng artifact ay ine-enforce ng JSON schema nito kasama ang integrity tests sa parehong
runtimes.

## 10. Credits at citation

Ang human judgments na sinummarize dito ay gawa ng **WMT Metrics
shared-task organizers and annotators** — kabilang sina Markus Freitag, Nitika
Mathur, Tom Kocmi, at maraming collaborator sa 2019–2025 campaigns —
at ng **Google MQM annotation program** (Freitag et al., *Experts,
Errors, and Context*, TACL 2021; `google/wmt-mqm-human-evaluation`). Ang
archive at toolkit ay minementena bilang `google-research/mt-metrics-eval`.
Sinusunod ng pairwise ranking accuracy sina Kocmi, Federmann et al. (2021), *To Ship
or Not to Ship*. Ang ambag ng Champollion ay ang per-language-family
organization, ang correlation computation, at ang honesty scaffolding
sa paligid nito — bawat numero sa artifact ay may `champollion-derived`
provenance na nagpapangalan sa upstream na pinanggalingan nito, at wala sa kanilang text,
judgments, o scores ang nire-redistribute.

Kapag nagci-cite ng reliability numbers mula sa artifact na ito, i-cite ang parehong WMT
campaign(s) na ina-attribute ng cells at ang artifact version ng Champollion (ang
`sources` block ang naglalaman ng eksaktong data pins), at igalang ang
non-commercial evidence lane na inilarawan sa §8.
