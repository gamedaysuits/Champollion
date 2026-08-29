---
sidebar_position: 8
title: "Espesipikasyon sa Pagbuo ng Queue"
slug: '/network/specifications/queue-construction'
description: "Ang malinaw na formula sa likod ng community-compute queue: expected-chain-value ranking, nakapublish ang bawat component, at maaaring muling makalkula nang mano-mano ang bawat rank."
related:
  - label: "Why the Queue Is Built This Way"
    to: /docs/network/perspectives/why-the-queue
    kind: position
    note: "The philosophy behind this formula"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
    note: "How to actually run queue items"
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "Small-corpus floors and noise thresholds the formula inherits"
---

# Espesipikasyon sa Pagbuo ng Queue

**Bersyon ng formula: `ecv-v3` (inaasahang chain value na may bridge
reliability).** Ang dokumentong ito ang normatibong depinisyon kung paano
inaayos ang
[champollion.dev/queue.json](https://champollion.dev/queue.json). Ang implementasyon
(`arena/scripts/generate_sweep_queue.py` sa pampublikong harness repo)
ay tumutugma sa pahinang ito bawat seksyon; inuulit ng metadata ng queue ang
eksaktong mga halagang parameter na ginamit sa oras ng pagbuo, at **bawat item
ay may dala ng buong breakdown ng formula nito**, kaya anumang rank ay maaaring
muling makuha sa pamamagitan ng kamay mula sa inilathalang JSON lamang. Kung ang
pahinang ito at ang queue ay kailanman hindi magtugma, iyon ay bug — pakireport
po ito.

**Ang queue ngayon, sa isang talata.** Ang pampublikong queue ay naglalaman ng parehong mga LLM item (naive at coached na mga kondisyon ng pag-prompt) at mga MT-service engine item sa iisang board, na niraranggo ayon sa pagkakasunud-sunod ng survey (`map`, §2.2): unang liwanag (first light) sa mga pares, wika, at pamilya bawat dolyar, na may first-reading boost para sa mga wikang hindi pa nasusukat (§2.2), mga budget tier na inilathala sa preview (§2.1.1), at ang kumpletong pagraranggo na inihahatid mula sa database (ang static na file ay naglalaman ng pinakamataas na bahagi kapag ang buong pagraranggo ay lumampas sa limitasyon ng laki nito, at sinasabi ito). Ang mga seksyon sa ibaba ay ang normatibong kahulugan, na pinapanatili kasama ang kanilang may-petsang kasaysayan ng desisyon — ang metadata sa anumang inihahatid na queue ay nagpapangalan sa mga eksaktong parameter na nagranggo rito.

> **v3 (2026-06-13).** Ang bawat edge ay isa na ngayong *bridge* na may dalawang numero —
> quality at reliability — at tumatakbo ang chain matrix sa product ng mga ito
> (§1.5). Ang 62 single-word vocabulary item na pinatakbo nang isang beses ay hindi na
> maaaring magmukhang path; ang mga replication, mas malalaking corpora, mas mayamang
> corpora, at mas masisikip na confidence interval ay lahat may presyong value. Ang mga v2 queue
> (quality-only) ay nananatiling naipapakahulugan sa pamamagitan ng sarili nilang metadata.

## 1. Ang layunin: isang mesh na tinitimbang ayon sa quality

Ang misyon ay *bawat wika tungo sa bawat wika sa pamamagitan ng nasukat na
mga individual pair chain*. Ang pagsasalin sa pagitan ng dalawang wikang walang
direktang benchmark ay isinasagawa sa pamamagitan ng **chaining** ng mga na-benchmark
na pares (X→pivot→Y), kaya ang halaga ng benchmark ay hindi ang bilang nito ng
corpora kundi ang **chain capacity ng graph nito**.

**Mga depinisyon.** Hayaan ang *benchmark graph* na magkaroon ng isang node kada wika
at, para sa bawat language pair na may hindi bababa sa isang inilathala at hindi na-disqualify
na run, isang **edge strength**

```
s(e) = (best published corpus-level chrF++ on that pair) / 100   ∈ [0, 1]
```

Ang corpus-level chrF++ ang kanonikal na inilathalang numero (tingnan ang
[Espesipikasyon sa Pagmamarka](/docs/network/specifications/scoring)); *best* dahil
daraan ang isang chain sa pinakamahusay na naipakitang system kada hop.
Ang mga pares na walang inilathalang run ay may s(e) = 0.

Ang **estimated chain strength** ng isang path P sa pagitan ng dalawang wika ay

```
strength(P) = λ^(|P|−1) · Π_{e ∈ P} s(e)
```

— ang edge qualities ay nagsasama nang multiplicative, at bawat *junction* (bawat
intermediate pivot) ay nagkakahalaga ng karagdagang fidelity factor na **λ < 1**.
Ang dalawang pagpiling ito ay nakaugat sa literatura ng pivot translation:
ang pagsasalin sa pamamagitan ng pivot ay mapagkakatiwalaang nawawalan ng quality kumpara sa direktang
pagsasalin, higit pa sa ipinahihiwatig ng naive composition (Utiyama & Isahara
2007; Wu & Wang 2007), ang laki ng pagkawala ay nakadepende sa napiling pivot
(Paul et al. 2009), at ang pagbuo ng *direct* non-English-centric
na mga pares ay nasusukat na mas mahusay kaysa sa English-pivoting sa malaking saklaw — nang ~10 BLEU sa
many-to-many setting ng M2M-100 (Fan et al. 2021). Ang λ ang palagiang paalala
ng formula na ang estimated chain ay hindi measurement: direktang run lamang ang
nag-aalis ng discount.

Ang **best-chain matrix** at ang **mesh objective** ay pagkatapos ay

```
Q(u,v) = max over paths P from u to v of strength(P)      (1 if u = v, 0 if disconnected)

Φ = mean over ordered language pairs (u ≠ v) of Q(u,v)    ∈ [0, 1]
```

Kinakalkula ang Q nang eksakto bilang shortest-path problem sa ilalim ng karaniwang
log transform (edge weight −ln(λ·s(e)) ≥ 0, Dijkstra, pagkatapos
Q = exp(−d)/λ). Ang Φ ay ang *global efficiency* construction nina
[Latora & Marchiori
(2001)](https://arxiv.org/abs/cond-mat/0101396) kung saan ang 1/distance kernel
ay pinalitan ng multiplicative chain fidelity — ang natural na kernel kapag ang mga edge
ay may per-hop quality retention sa halip na unit lengths. (Ang Queue v1 ay nag-rank ayon sa unweighted
global efficiency gain — ang special case ng pamilyang ito kung saan ang lahat ng
alam ninyo tungkol sa isang edge ay kung umiiral ito.)

### 1.5 Reliability: ang bridge ay (q, r)

Ang makinang na score sa isang napakaliit, manipis, at hindi kailanman na-replicate na corpus ay hindi
bridge. Kaya sa v3, hinahati ang bawat nasukat na edge sa:

```
quality      q(e)   = best published corpus-level chrF++ / 100
reliability  r(e)   = f_size · f_rich · f_conf · f_repl        ∈ [0, 1]
effective    s_eff(e) = q(e) · r(e)        ← what chains compose over
```

| Factor | Depinisyon | Full credit sa | Anchor |
|---|---|---|---|
| `f_size` | min(1, n/100), n = evaluated entries ng best run | 100 entries | ang significance floor ng [disenyo ng corpus](/docs/network/specifications/corpus-design); pinatutunayan ni Koehn (2004) ang bootstrap testing sa mga set na ~300 pangungusap — kahit 300 ay "small", kaya dini-discount ng laki ang reliability sa halip na basta i-gate lamang ang display |
| `f_rich` | min(1, L̄/5), L̄ = mean *effective* source length | 5 effective words | pinili ng AmericasNLP (Mager et al. 2021) ang chrF dahil nasisira ang word-level units sa rich morphology; idinudokumento nina Mager et al. (2022) ang whitespace tokens bilang maling unit |
| `f_conf` | min(1, 5/h), h = chrF 95% CI half-width ng best run (proxy `50/√n` kapag hindi nailathala) | CI ≤ ±5 chrF | ang noise floor na sa ibaba nito ay hindi mapag-iiba ang mga delta sa maliliit na corpora; ipinapakita nina Kocmi et al. (2021) na ang within-CI deltas ay madalas sumasalungat sa human preference |
| `f_repl` | min(1, runs/2) | 2 published runs | Marie, Fujita & Rubino (2021), meta-evaluating 769 papers: ang unreplicated single comparisons ang dokumentadong credibility failure ng larangan |

Ang **effective length** ay sinusukat sa content units, hindi whitespace
words: `L̄ = mean source chars / c(L)`, kung saan ang *character economy*
`c(L)` ay ang median characters sa panig ng wikang L kada English word
sa naka-align na panig, na sinukat mula sa sariling parallel corpora ng proyektong ito
(7,400+ aligned entries sa oras ng paglabas ng v3: cmn 1.6, jpn 2.3, kor 2.6;
eng baseline 5.0; deu 6.0; crk 4.7 — ang polysynthetic words ay pinapresyuhan ayon sa
content na dala nila). Walang typology lookup tables; humuhusay ang estimate
habang lumalaki ang corpora; ang mga wikang walang eng-paired data ay gumagamit ng default
economy. Naka-stamp kada corpus sa registry (`richness` block).

**Bridge tiers** (display vocabulary): **established** — n ≥ 100,
L̄ ≥ 5, h ≤ 5, runs ≥ 2; **provisional** — measured ngunit may anumang hindi pumapasa;
**registered** — walang published runs. Ang isang chain claim ("makararating kayo mula X
patungong Y") ay kasinglakas lamang ng tier ng pinakamahina nitong hop, at ipinapakita ng mesh
visualization ang reliability bilang edge opacity.

**Worked checks** (mula sa checked-in verification script, pinatakbo bago
ilabas ang v3): *62 single-word vocabulary items, one run* → r ≈ **0.04**
(hindi path); *200 sentences, ±3 CI, 3 runs* → r = **1.00**; isang
101-entry Japanese corpus na ang naive word count ay 1.0 (script
artifact) ay na-rehabilitate sa 6.5 effective words at full `f_rich`.
Ang bounds at per-factor monotonicity ay property-tested.

**Value ng isang run sa ilalim ng v3.** Maaaring pagbutihin ng isang run ang bridge sa dalawang paraan, at
kinukuha ng ΔΦ ang mas mabuti: **(a)** ito ay nagiging best run ng edge —
`ŝ_eff = predicted quality × r(its corpus's n, richness, CI proxy,
runs+1)`; o **(b)** nagre-replicate lamang ito — nananatili ang kasalukuyang best,
tumataas ang `f_repl`. Kaya ang replication sa isang single-run edge ay tunay at
may presyong value, at ang mas malaki o mas mayamang corpus sa isang nasukat na pares
ay mas mataas ang rank kaysa sa re-run ng maliit. Inilalantad ng mga item ang `edge_quality`,
`edge_reliability`, `edge_tier`, `effective_strength`,
`post_run_reliability`, at `predicted_effective` kasabay ng v2
prediction fields.

**Kung ano ang hindi Φ.** Ang Φ ay internal prioritization currency ng queue,
hindi capability claim. Ang mga input nito ay development-set scores kasama ang lahat
ng caveat ng [Corpus Design
Framework](/docs/network/specifications/corpus-design): maaaring training-data
contamination na ginagawang upper bound ang bawat score, ang chrF++ values ay hindi
mahigpit na maikukumpara sa iba't ibang wika, at ang maliliit na corpora ay may malalapad na
confidence interval. Kailangan lamang ng formula ang Φ upang *i-order ang mga run ayon sa
usefulness*; hindi ito kailanman inilalathala bilang quality guarantee.

## 2. Ang decision problem

Ang mga bukas na item ng queue ay ang bawat kumbinasyon ng (corpus, modelo, kondisyon) na karapat-dapat (development split, redistributable na lisensya, hindi naka-quarantine, transmission-eligible, at **benchmark-resolvable** — tingnan ang language-identity gate sa §2.2) at wala pa sa leaderboard. Ang mga magkakaparehong re-run ng mga saklaw na kumbinasyon ay hindi kasama — ang mga run-card fingerprint ay nagde-dedupe sa mga ito sa pag-publish — ngunit ang mga bagong modelo o kondisyon sa isang nasukat na pares ay nananatiling mga bukas na item.

Ang contributed compute ay budget. Ang pagpili kung aling open item ang susunod na patatakbuhin
upang pinakamabilis na umunlad ang mesh ay isang budgeted coverage-style
maximization, at ang kanonikal na approach ay greedy selection ayon sa
**marginal value per unit cost**: para sa monotone submodular objectives,
may klasikong (1 − 1/e) guarantee ang greedy rule (Nemhauser,
Wolsey & Fisher 1978), at ang benefit/cost-ratio form nito ang standard
algorithm sa ilalim ng budgets (Khuller, Moss & Naor 1999). Ginagamit namin ang
ratio rule bilang aming prinsipyo sa ranking. (Tapat na tala: ang aming objective ay may
coverage-like diminishing returns sa deterministic core nito, ngunit ang
stochastic prediction layer ay nangangahulugang binabanggit namin ang greedy guarantee bilang
*motivation*, hindi bilang theorem tungkol sa eksaktong system na ito.)

```
ECV(item) = ΔΦ(item) / max(est_cost_usd, COST_FLOOR)
```

Niraranggo ang mga item ayon sa pababang ECV. Ang ties ay binabasag: naive bago coached,
mas mura muna, pagkatapos item id.

### 2.1 Mga remedyo sa pagraranggo — 2026-07-12

Apat na pagsasaayos na ipinatong sa greedy ECV rule, na bawat isa ay nakatala rin sa
metadata ng queue (`priority_parameters.contamination_ecv_factors`,
`priority_parameters.frontier_interleave`, `metadata.preview_policy`):

1. **Multiplier ng kontaminasyon.** Ang ECV ng bawat item ay minumultiply sa
   factor mula sa contamination grade ng corpus nito: **LOW 1.0 / MEDIUM
   0.4 / HIGH 0.1**, kung saan ang hindi alam o nawawalang grade ay itinuturing na
   MEDIUM (huwag kailanman ipalagay na malinis). Rationale: ang malinis na chain graph ay
   tumatanggap lamang ng LOW-contamination edges, kaya ang non-LOW run ay hindi makakapasok dito
   at hindi dapat malampasan ang clean-mesh work na may kaparehong cost. Ang mga non-LOW item ay
   nananatiling naka-queue — tunay na value ang relative-lane comparisons — sadyang
   nasa mas mababang ranggo lamang sila kaysa sa malinis na trabaho.
2. **Pagsisingit ng frontier.** Pagkatapos ng greedy sort, bawat ika-5 priority
   slot ay naglalaman ng pinakamataas ang ranggong item na hindi pa nailalagay mula sa
   frontier-model set (pinananatili bilang data sa generator at nakatala rin
   sa metadata), upang ang frontier evidence ay makarating nang maaga sa prediction
   priors sa halip na pagkatapos lamang mapuno ang murang tiers. Purong
   reordering ito: walang inaalis o dinodoble, ang frontier item na
   nakakuha ng natural na slot ay pinananatili iyon, at ang mga priority ay binibilang mula
   sa pinagtagping ayos — ang inilathalang ranking ang katotohanan.
3. **Preview source-hub cap.** Ang top-25 public preview ay nagpapakita ng
   hindi hihigit sa **6** item na may iisang source language, upang hindi mamonopolyo ng isang
   hub na maraming resource ang shop window. Pinananatili ng over-cap
   items ang kanilang tunay na priority sa buong queue; hinihila lamang ng preview
   ang susunod na eligible item sa pagkakasunod-sunod ng ranking.
4. **Pagbubukod ng constructed-language sa preview.** Nilalaktawan ng preview ang mga item na ang source o
   target ay constructed language. Ang pagtukoy ay card-family-driven (ang Artificial
   Language bucket ng Glottolog, binabasa mula sa mga language card — hindi kailanman hardcoded
   language set), at inilalathala ang derived code list sa
   `metadata.preview_policy` upang ilapat ng server-side refreshes ang parehong
   seleksyon.

Ang (3) at (4) ay **presentation policy lamang**: hindi naaapektuhan ang buong `queue.json`,
ang ranking nito, at ang mga priority nito.

### 2.1.1 Mga budget tier — "ano ang mabibili ng $X?" (2026-08-24)

Ang `queue-preview.json` ay nagdadala ng isang `budget_tiers` array na nagbubuod, para sa mga badyet na **$1 / $10 / $100 / $1000**, ng greedy affordable prefix ng inilathalang pagraranggo: daanan ang mga item sa pagkakasunud-sunod ng prayoridad, kunin ang bawat item na ang tinantyang halaga ay pasok pa rin sa badyet, lagpasan ang mga hindi, at patuloy na punan ng mga susunod na mas murang item. Ang bawat tier ay nag-uulat kung ilang item ang mabibili nito, ang kanilang kabuuang tinantyang halaga, kung ilang magkakaibang pares ng wika at modelo ang naaabot ng mga ito, at kung gaano kalalim sa pagraranggo ang naaabot ng badyet (`max_priority`).

Dahil ang pagraranggo ay marginal-value-per-cost na (§2), ang greedy affordable prefix **ay** ang alokasyon na inirerekomenda ng modelong ito para sa paggastos na iyon — ang isang maliit na contributor at isang malaki ay parehong nakakabasa ng isang konkreto at pinakamainam na sagot mula sa iisang inilathalang pagraranggo, sa halip na isang listahan na hindi angkop sa sinuman. Ang mga tier ay mga buod lamang: ang alokasyon mismo ay ang pagraranggo lamang, na dinaanan nang sunud-sunod laban sa iyong sariling badyet. Ang mga server-side refresh ay muling nagkukuwenta sa mga tier sa mga natitirang item gamit ang magkaparehong pagdaan (ang generator at ang refresh function ay nagpapatupad nito bilang kambal, na sinubukan sa parehong panig).

### 2.2 Mga lane at ranking mode — 2026-07-19

Ang inihahatid na queue ay nagdedeklara, sa sarili nitong metadata, kung aling **lane** ang dala nito at kung aling **ranking mode** ang nag-ayos dito. Ang metadata ang awtoridad; tinutukoy ng seksyong ito ang bokabularyo.

**Mga Lane** (`metadata.lane`, `metadata.lane_policy`). Mula noong 2026-08-27, ang pampublikong queue ay nagdadala ng **both** lane: mga LLM item (modelo × kondisyon ng pag-prompt) **at** mga MT-service item (kondisyon `engine` — DeepL, Google Translate, Microsoft Translator, LibreTranslate, Tilde; ang bawat isa ay nag-e-enqueue lamang para sa mga pares sa loob ng sarili nitong inilathalang listahan ng saklaw). Ang 2026-07-19 **llm** lane — mga LLM item lamang, na limitado sa mga pares kung saan ang kahit isang panig ay nasa labas ng inilathalang saklaw ng bawat MT service — ay nagreserba ng service benchmarking para sa mga kampanyang pinapatakbo ng organizer na hindi kailanman tumakbo, na nag-park sa karamihan ng katalogo; ang pagsukat sa mga serbisyo *ay* ang backbone ng mapa ng saklaw, kaya ang parehong uri ng trabaho ay nakaupo na ngayon sa iisang board. Ang coverage union (macrolanguage-aliased sa pamamagitan ng mga language card) ay inuulit pa rin bilang `service_coverage_methods` at `service_covered_languages`, at ang isang llm-lane queue ay nag-uulat pa rin ng mga hindi kasamang pares nito bilang `pairs_dropped_fully_covered`.

**Blob size cap** (2026-08-27). Ang inihahatid na `queue.json` ay isang static na file na may mahigpit na limitasyon sa hosting, kaya kapag ang buong pagraranggo ay lumampas dito, ang file ay nagdadala ng **top slice** ng pagraranggo at sinasabi ito sa `metadata.blob_truncated {kept, total}` — hindi kailanman isang tahimik na limitasyon. Ang database queue (`queue_top()` / `queue_pairs()`) ay palaging naghahatid ng **kumpletong** pagraranggo at ito ang awtoritatibong listahan ng trabaho; inilalarawan ng pair aggregation at mga budget tier ng preview ang artifact na kasama nilang ipinapadala.

**Language-identity gate** (2026-07-19). Ang mga queue item ay nagta-target lamang ng mga **aktibong indibidwal na ISO 639-3 code** — ang isang marka laban sa isang macrolanguage ("Arabic") o isang collective family code ("Berber languages") ay magiging isang hindi mapapasubaliang pag-angkin tungkol sa mga barayti na hindi kailanman nasuri (ang parehong pangangatwiran na sinusunod ng FLORES-200/NLLB sa pamamagitan ng pag-code ng data bilang `arb`/`quy`/`zsm`). Ang mga upstream na label ng corpus ay *nire-resolve*, hindi kailanman sinusunod o binabalewala: ang mga script tag ay mekanikal na inaalis (ang isang `eng→cmn-Hans` na corpus ay nag-e-enqueue para sa `eng→cmn`, ang script ay pinapanatili bilang item display metadata `source_script`/ `target_script`); ang mga malinis na niretiro na code ay sumusunod sa kanilang opisyal na kahalili sa ISO; at ang isang macro-labeled na corpus ay nag-e-enqueue lamang sa ilalim ng isang naitala at binanggit na **variety resolution** sa registry entry nito (hal. dinodokumento ng FLORES+ ang Quechua nito bilang `quy`). Ang mga corpus na hindi nare-resolve sa alinmang landas ay hindi isinasama nang may mga machine-readable na dahilan na inilathala sa `metadata.doctrine_exclusions` (kabuuan, mga bilang bawat dahilan, mga dahilan bawat corpus) at binibilang sa desert ledger (`service_landscape.invisible_reasons.corpus_excluded_by_doctrine`) — mga nakikitang pagbubukod, hindi kailanman mga tahimik na pag-drop. Ang mga makasaysayang resulta sa mga umbrella-labeled na corpus ay nagpapanatili ng kanilang sariling tapat na pinangalanang mesh node (node `scope`: `macrolanguage` / `collective` / `retired`), na hindi kailanman isinasama sa isang miyembrong barayti. Ang mga resolution input ay inilalathala lahat: ang mga `language_resolution` stamp bawat entry ng registry ay nagdadala ng mga nare-resolve na code, saklaw, at pin citation.

**Mga ranking mode** (`metadata.rank_mode`, inilarawan sa `metadata.priority_model`). Dalawang pagkakasunud-sunod ng parehong mga item:

- **ecv** — ang greedy expected-chain-value rule ng §2–§3: pagpapabuti ng mesh bawat tinantyang dolyar. Ang exploitation ordering; tama kapag ang board ay sapat na ang density para sa mga prediksyon at ang ΔΦ ay magdala ng signal.
- **map** (map-value v2) — ang survey ordering:
  `MapValue = novelty × uncertainty × promise × connectivity ×
  corpus-quality × contamination ÷ cost`, na binuo ng isang eksaktong greedy
  trace. Ang *Novelty* ay positional first-light credit na nababawasan habang
  ang mga nailagay nang item ay sumasakop sa parehong directed pair (1/(1+n)), target
  na wika, target na pamilya, method × target-family cell, at target ×
  domain cell (bawat isa ay 1/√(1+n); mga pamilya mula sa mga language card,
  mga domain mula sa taxonomy ng corpus registry — ang maagang saklaw ng isang target ay dapat kumalat sa mga register, hindi ulitin ang unang domain
  na nasukat). Ang *Uncertainty* ay ang back-off depth ng prediksyon ng §3.1
  (pares 0.25 · target-language 0.55 · source-language 0.75 · global
  1.0) × 1/(1+mga inilathalang run sa edge). Ang *Promise* ay ang hinulaang lakas ng §3.1
  na naka-floor sa 0.25 — nangunguna ang mga malamang na gumaganang hindi alam,
  at ang pagmamapa ng isang posibleng disyerto ay nagdadala pa rin ng halaga. Ang *Connectivity*
  ay nagtataas ng ranggo ng mga pares na **nag-uugnay sa nasukat na network sa isang wikang
  hindi pa nito maabot**: ang isang endpoint ay *established* kapag ito ay nasa isang
  nasukat na mesh edge (`mesh.json`, status `measured`) o sa loob ng inilathalang listahan ng saklaw ng anumang MT
  service (macrolanguage-aliased, ang parehong aliasing gaya ng lane gate sa itaas); ang mga **bridge** (eksaktong isang
  established na endpoint) at mga **island** (wala sa dalawa) ay parehong nakakakuha ng markang 1.0 —
  mula noong 2026-08-27 ang first light ng isang nakadiskonektang disyerto ay ganap na binibilang
  (ang mga island ay nakakuha ng markang 0.5 sa ilalim ng 2026-07-19 grow-out-of-the-network
  sizing, na istruktural na nagbaba sa pinakamalalim na tail) — habang
  ang **interior** densification (parehong established) ay nakakakuha ng markang 0.5:
  ang pagpapalakas sa pagitan ng mga kilalang punto ay trabaho ng ecv mode. Ang isang
  **first-reading boost** (×2.0) ay karagdagang nagpaparami sa survey
  value ng anumang item na ang pinagmulan o target na wika ay may ZERO na inilathalang
  mga sukat saanman — ang ika-siyam na prinsipyo, na malinaw na isinasaad: **ang
  unang pagbasa ng isang wika ay mas mataas ang ranggo kaysa sa pagpipino (refinement)**. Ang uncertainty
  factor lamang ay hindi maipapahayag ito (binibigyan nito ng parehong marka ang isang hindi nasukat na pares
  sa pagitan ng dalawang mahusay na nasukat na wika at ang isang hindi kailanman nasukat
  na wika); ginagawa ng boost ang first light ng long tail bilang isang nakasaad na
  layunin sa halip na isang hindi sinasadyang aksidente. Ang parehong mga factor ay sumasakay sa
  `metadata.map_value_parameters` at parehong inilalapat sa loob ng
  survey component ng edv (§2.3).

  Ang kabilang kalahati ng ika-siyam na prinsipyo ay naninirahan sa LABAS ng pagraranggo: walang
  pagkakasunud-sunod ng mga umiiral na item ang makakaabot sa isang wika na walang corpus
  man lang (~7,500 na mga buhay na individual-code na wika ngayon). Ang **corpus
  wish-list** (`/corpus-wishlist.json`, na muling binubuo sa tabi ng queue)
  ay naglalathala ng acquisition frontier na iyon: bawat buhay, individual-code,
  zero-corpus na wika na niraranggo ayon sa pinakamahusay na binanggit na bilang ng nagsasalita nito —
  ang bilang ng nagsasalita bilang feasibility proxy para sa isang komunidad na
  talagang makakabuo ng isang corpus — bawat bilang ay iniuugnay sa pinagmulan nito at
  hindi kailanman pinagpapasyahan (arbitrated).
  Ang *Corpus-quality* ay ang intrinsic reliability potential ng corpus
  `f_size × f_rich` mula sa §1.5 — ang survey ay dapat mapunta sa mga corpus na
  kayang magdala ng bigat, kaya ang isang 62-entry na single-word vocabulary list ay hindi na
  nangunguna dahil lamang sa ito ay mura; ang isang nawawalang sukat ng richness
  ay nananatiling neutral (ang kawalan ng sukat ay hindi katibayan ng kakulangan). Ang
  disiplina sa gastos at kontaminasyon ay kapareho ng sa ecv. Ang frontier
  interleave at mga tie-break (§2.1) ay inilalapat nang walang pagbabago. Tama para sa
  yugto ng survey: pinapalaki nito kung ano ang *natututunan ng mapa* bawat dolyar — mga unang
  sukat sa mga pares, wika, pamilya, method-cell, at domain, na lumalago mula sa
  nasukat na network sa halip na magkawatak-watak — sa sinadyang halaga ng mas mabagal na paglago ng lakas ng mesh.

> **map-value v2 (2026-07-19).** Dalawang founder-directed na karagdagan sa
> survey ordering: ang mga pares na *nag-uugnay (bridge) sa nasukat na network* ay
> nauuna na ngayon sa ranggo kaysa sa mga nakadiskonektang probe at interior densification, at
> ang kalidad ng corpus (size floor × effective richness, §1.5) kasama ang
> per-target domain spread ay nagtitimbang sa pagraranggo — ang contributor compute
> ay dapat mag-ugnay ng mga established na landas sa mga bago, sa mga corpus na sapat ang ganda upang
> hawakan ang bigat. Ang lisensya ay nananatiling isang **gate, hindi isang weight**: ang mga panuntunan sa paglilisensya
> at transmission-channel ang nagpapasya kung ano ang maaaring i-queue (§2,
> at ang `transmission_note` ng queue); sa mga karapat-dapat na corpus ang
> pagraranggo ay license-blind, kaya ang mga restricted-but-pinned na research set —
> na kadalasang tanging corpus ng isang pares — ay hindi kailanman sistematikong pinagkakaitan. Ang mga v1
> queue (novelty × uncertainty × promise lamang) ay nananatiling naiintindihan
> sa pamamagitan ng sarili nilang metadata.

Ang mga eksaktong halaga ng factor na ginamit sa pagbuo ay ipinapadala sa
`metadata.map_value_parameters`; ang mga connectivity at quality input
ay maaaring muling makuha mula sa inilathalang `mesh.json` (mga nasukat na edge), ang
service coverage union na inuulit sa metadata, at `registry.json`
(mga bilang ng entry + richness). Ang bawat item ay karagdagang nagpapanatili ng buong
ecv-v3 diagnostic field anuman ang mode, kaya ang alinmang pagkakasunud-sunod ay maaaring
muling makuha mula sa parehong mga artifact.

### 2.3 Ranking mode `edv` — expected decision value (2026-08-27)

*Status: ipinatupad, naka-off bilang default habang hinihintay ang nasukat na paghahambing sa
§2.3.6. Ang inilathalang default ay nananatiling `map` hanggang sa panahong iyon.*

Ang queue ay bumibili ng eksaktong dalawang produkto: ang **capability map** (kung aling
paraan ang magaling sa kung ano, na may tapat na kawalan ng katiyakan) at ang **routing
mesh** (mga nasukat na pares na nagiging mga ruta). Pinipresyohan ng `edv` ang bawat
kandidatong item ayon sa kung gaano nito isinusulong ang pareho, bilang isang weighted portfolio:

```
EDV(item) = [ w_judge·Ĵ + w_mesh·M̂ + w_survey·Ŝ ] × contamination ÷ max(cost, COST_FLOOR)
```

na may mga default na `w_judge = 0.35, w_mesh = 0.25, w_survey = 0.40`
(founder-dialable; ang bawat pagbuo ay inuulit ang mga weight na aktwal na ginamit sa
`metadata.edv_parameters`). Ang contamination factor (§2.1 remedy 1) ay
inilalapat nang eksaktong isang beses, bilang outer multiplier. Ang paglilisensya at
transmission ay nananatiling mga **gate, hindi mga weight** — ang pagiging karapat-dapat ay pinagpapasyahan
bago makwenta ang anumang halaga, at ang pagraranggo ay license-blind sa mga
karapat-dapat na corpus.

#### 2.3.1 Ĵ — method-judgment value

Pinipresyohan kung gaano isinusulong ng run ang **pag-aayos ng mga same-corpus method
comparison** — ang tanging cross-method na pag-angkin na pinapahintulutan ng sariling
pananaliksik sa pagsukat ng proyektong ito. (Tinanggihan ng W2 difficulty-transfer study
ang cross-language ability linking; ang pinahihintulutang positibong resulta nito —
within-language additive method × corpus adjustment — ay eksaktong
ginagamit ng component na ito. Ang mga marka ay ginagamit lamang para sa pag-aayos at paghihiwalay,
hindi kailanman kino-convert sa mga acceptability probability, ayon sa calibration
pilot.)

Para sa isang kandidato (corpus C, method M, kondisyon): ang mga **contrast
partner** ay ang mga method M′ na mayroon nang inilathalang run sa
(C, parehong kondisyon). Para sa bawat partner, kung saan ang `sep` ay ang
paghihiwalay ng marka sa mga chrF point sa ibabaw ng mga pooled CI half-width (mga naitalang CIs; proxy `50/√n`
kapag hindi inilathala), at ang `sep_pred` ay ang parehong kinwenta laban sa hinulaang marka ng §3.1:

| contrast state ng {M, M′} sa pares | credit |
|---|---|
| **unmet** — wala pang nakabahaging corpus | `JUDGE_FIRST = 1.0` |
| **contested** — may mga nakabahaging corpus, lahat ay `sep < Z_DEC` | `JUDGE_CONTESTED = 0.8 × clip(sep_pred / Z_DEC, 0, 1)` |
| **decided** — may ilang `sep ≥ Z_DEC`, pinagpapasyahan ito ng n_dec na mga corpus | `JUDGE_DECIDED = 0.25 / (1 + n_dec)` |

bawat isa ay pinarami ng `w_top = 1/√(rank(M)·rank(M′))` — ang pagpapasya sa unang
pwesto laban sa ikalawa ay mas mahalaga kaysa sa ikapito laban sa ikawalo. Ang
per-pair method ranking ay gumagamit ng pinahihintulutang additive method × corpus fit
(alternating least squares sa mga naobserbahang cell) kapag ang pares ay may ≥2
method × ≥2 corpus na nasukat, kung hindi ay per-method best score; ang fit ay
**mahigpit na bawat pares, hindi kailanman pinagsasama-sama sa mga wika**. `Z_DEC = 1.96`.

Ang isang coached-vs-naive na contrast sa parehong (C, M) ay nagdaragdag ng
`JUDGE_COND = 0.5 / (1 + n_cond)`. Ang mga contrast ng isang item ay pinagsasama-sama nang may
diminishing returns (`JUDGE_GAMMA = 0.7` bawat karagdagang contrast,
na nakaayos nang pababa), kasama ang isang **seed term**
`JUDGE_SEED = 0.25 × min(1, m_C/3) × corpus-quality` (m_C = iba pang mga
lineup method na may queue item sa C) kaya ang isang walang laman na board ay mas pinipili pa rin ang mga corpus
kung saan ang mga hinaharap na paghahambing ay maaaring husgahan — venue value, hindi kailanman isang hiniram na marka. Sa panahon ng pagbuo, ang judge component ay nababawasan ng
`1/(1 + items already placed on the same pair and condition lane)`.

#### 2.3.2 M̂ at Ŝ

Ang `M̂` ay ang expected mesh gain (ΔΦ) ng §3, walang pagbabago, kung saan ang chain matrix
ay naka-freeze sa oras ng pagbuo. Ang `Ŝ` ay ang map-value v2 core ng §2.2 —
`uncertainty × promise × connectivity × corpus-quality` na may
positional novelty decay — walang pagbabago. Ang predicted-score *level*
(promise) ay naninirahan lamang sa Ŝ; ang Ĵ ay gumagamit lamang ng mga score *separation* — ang dalawang
component ay hindi maaaring mag-double-count sa parehong optimismo.

#### 2.3.3 Normalization

Ang tatlong component ay naninirahan sa mga incommensurable scale, kaya ang bawat static na
component ay hinahati sa 95th percentile nito sa ibabaw ng candidate set
(naka-cap sa `EDV_NORM_CAP = 4.0`); ang tatlong normalizer ay ipinapadala sa
`metadata.edv_parameters.normalizers`, na ginagawang muling makukuha ang bawat inilathalang EDV value
mula sa sarili nitong mga artifact.

#### 2.3.4 Pagbuo (Assembly)

Ang pagkakasunud-sunod ay ang parehong eksaktong lazy-greedy trace gaya ng map mode: ang bawat
order-dependent multiplier (survey novelty, judge placement decay) ay
monotone non-increasing habang inilalagay ang mga item, kaya ang isang stale heap entry ay maaari
lamang mag-overestimate — ang lazy-greedy invariant ay nananatili at ang trace
ay katumbas ng brute-force greedy. Ang frontier interleave, preview policy, at
mga budget tier ay inilalapat nang walang pagbabago.

#### 2.3.5 Explainability

Ang bawat item ay nagpapanatili, sa mga diagnostic nito: ang listahan ng contrast kung saan ito
binigyan ng credit (partner, state, predicted separation, rank weight), ang
mga seed at decay term, lahat ng field ng §2.2 at §3, ang mga weight at
normalizer — ang inilathalang EDV value ay eksaktong muling makukwenta mula sa
row. Ang "Paano nakuha ng item na ito ang ranggong ito?" ay masasagot nang walang anumang
external state.

#### 2.3.6 Pamantayan sa pag-adopt (Adoption criterion)

Ang `edv` ay nagiging inilathalang default lamang pagkatapos ng isang nasukat na paghahambing
laban sa `map` at `ecv` sa parehong board: sa loob ng 10% ng map sa bawat
survey metric (first-light depth percentiles, magkakaibang
pares/wika/pamilya sa lalim, marginal-new-pair rate), mahigpit na
mas mahusay sa parehong judge metric (mga contested contrast na nare-resolve bawat
simulated na $1k; method-ranking recovery sa nakatakdang paggastos), at
ang mesh-growth-per-dollar ay hindi mas malala kaysa sa map. Ang ulat ng paghahambing ay
inilalathala kasabay ng pagbabago (flip).

## 3. Ang value ng isang run

### 3.1 Pagpredict ng score bago patakbuhin

Ang expected score ng isang hindi pa napapatakbong (pair, model, condition) ay isang
sadyang simple at ganap na maiinspeksiyong sum — isang two-way main-effects
prediction plus structured optimism, kung saan ang bawat term ay inilathala sa item:

```
ŝ = clip( pair_prior + model_offset + condition_offset + exploration_bonus,  0, S_CAP )
```

- **`pair_prior`** — hierarchical back-off sa ibabaw ng published strengths:
  mean sa pair na ito → mean sa target language na ito → mean sa
  source language na ito → global mean → `S0_FALLBACK`. Ang ginamit na level ay
  inilalathala bilang `prior_basis`.
- **`model_offset`** — kung paano gumaganap ang model na ito kumpara sa *ibang*
  mga model sa parehong pair, na ina-average sa lahat ng pair kung saan may comparison.
  Zero para sa mga model na hindi pa kailanman nakita.
- **`condition_offset`** — ang naobserbahang coached-minus-naive delta sa
  parehong pair (falling back sa parehong target language), at **zero
  kung hindi**: ang coaching gains ay tunay kung saan nasukat ngunit hindi
  ipinapalagay na lumilipat sa iba't ibang wika, kaya sa mga pair na walang ebidensya,
  nananatili ang baseline-first convention.
- **`exploration_bonus`** — optimism sa harap ng kawalan ng katiyakan, gamit ang
  UCB1 schedule (Auer, Cesa-Bianchi & Fischer 2002):
  `κ·sqrt(2·ln(1+N)/(1+n))`, kung saan ang N ay ang kabuuang bilang ng published
  scored runs at ang n ang bilang sa (pair, model) na ito. Ang mga cell na hindi pa kailanman nasubukan
  ay nakakakuha ng pinakamalaking bonus; ang mga cell na mahusay nang nasukat ay bumababa patungong zero.
  Hiniram namin ang schedule — ang hugis na nagpapabalik sa under-explored arms
  sa tamang rate — hindi ang regret theorem, na nagpapalagay ng stationary bandit na hindi ganito ang system.

### 3.2 Ang mesh gain, sa closed form

Maaari lamang pagbutihin ng isang run ang mesh sa pamamagitan ng pagtataas ng edge ng pair nito sa
`s' = max(s(e), ŝ)`. Para sa single-edge change, ang bagong best chain
sa pagitan ng anumang dalawang wika ay maaaring hindi pansinin ang bagong edge o gamitin ito
nang eksaktong isang beses, kaya ang upgraded matrix — at samakatuwid ang ΔΦ — ay may eksaktong
one-line form (hindi kailangang muling i-solve ang buong graph):

```
Q'(u,v) = max( Q(u,v),  E(u,a)·s'·E(b,v),  E(u,b)·s'·E(a,v) )

E(x,y) = λ·Q(x,y) for x ≠ y;  E(x,x) = 1        (edge e = {a, b})

ΔΦ = mean over ordered pairs of (Q'(u,v) − Q(u,v))
```

Ang E ay "ang best chain patungo sa endpoint ng bagong edge, na binabayaran ang junction
upang i-splice dito"; ang dalawang term ay ang dalawang direksyon ng pagtawid
sa edge. Sinusubok ito sa harness suite laban sa brute-force
recomputation ng Φ.

Ang prediction na hindi kayang higitan ang kasalukuyang edge strength ay nagbubunga ng
ΔΦ = 0: ginugugol ng formula ang pera ng donors sa pagkumpirma ng hindi alam, hindi
sa muling pagsukat ng naipakita na. (Pinipigilan ng exploration bonus ang mahihina o
under-sampled cells na tuluyang magutom.)

### 3.3 Ano ang binibilang bilang evidence kumpara sa maaaring i-queue

Dalawang magkaibang gate, na sadyang asymmetric:

- Ang **Evidence** ay nagmumula sa *bawat* published, non-disqualified run —
  kabilang ang runs sa corpora na hindi maaaring i-publicly queue (hal.
  non-commercially licensed sets). Ang published measurement ng isang pair
  ay kaalaman kahit hindi ninyo ito maaaring i-re-run.
- Ang **Actions** (queue items) ay nagmumula lamang sa openly runnable corpora:
  development split, CC-BY-family license, na maaaring i-fetch ng sinuman.

Ang mga wikang reachable lamang sa pamamagitan ng non-queueable corpora ay nananatili pa rin
sa graph: ang pagpapabuti ng mga edge *sa paligid* ng mga ito ay nagbabago ng kanilang chain values,
at isinasaalang-alang ito ng formula.

## 4. Mga parameter

| Parameter | Default | Kahulugan at katwiran |
|---|---|---|
| `λ` (`lambda_junction_discount`) | **0.9** | Per-junction fidelity retention ng isang *estimated* chain. Ine-encode ang "direct measurement beats product-equal chaining" (Utiyama & Isahara 2007; Wu & Wang 2007; Fan et al. 2021). Ang ~10% haircut ay calibration choice, na muling susuriin habang naiipon ang measured chain triangles (§6). |
| `κ` (`kappa_exploration_scale`) | **0.05** | Exploration bonus scale, sa strength units. 0.05 ≡ 5 chrF++ points — ang noise floor na sa ibaba nito ay hindi mapag-iiba ang score differences sa sub-100-entry corpora ([Corpus Design §6.3](/docs/network/specifications/corpus-design)). Ang optimism ay capped sa resolution ng instrument. |
| `S_CAP` | **0.95** | Prediction ceiling — walang estimated edge ang maaaring mag-claim ng near-perfect fidelity na hindi nito naipakita. |
| `S0_FALLBACK` | **0.5** | Pair prior of last resort, ginagamit lamang kapag wala talagang published results (mas pinipili ang observed global mean — ≈ 0.54 sa unang 429 runs — kapag may anumang resulta). |
| `COST_FLOOR` | **$0.01** | Floor para sa ECV denominator, upang hindi makapag-claim ng unbounded value per dollar ang near-free runs. |
| `N_FULL` | **100** | Evaluated entries para sa full size credit (§1.5). |
| `L_HEALTHY` | **5.0** | Effective words para sa full richness credit (§1.5). |
| `H_NOISE` | **±5 chrF** | CI half-width para sa full confidence credit; ang missing CIs ay naka-proxy bilang 50/√n (naka-anchor sa ±5 sa n=100). |
| `RUNS_FULL` | **2** | Published runs para sa full replication credit. |

**Versioning.** Ang mga pagbabago sa parameter o formula ay nagpapataas ng `formula_version`
(metadata) at ng version line ng pahinang ito. Palaging inuulit ng queue ang
eksaktong mga halagang ginamit sa ilalim ng `metadata.priority_parameters`, kabilang ang
kasalukuyang Φ, kaya nananatiling naipapakahulugan ang historical queues. Ang sensitivity
runs ay isang flag lang ang layo: `generate_sweep_queue.py --lam 0.8 --kappa 0.1`.

## 5. Worked example (live values, 2026-06-12)

Generation laban sa 424 scored runs, 59 measured edges, 60 languages;
**Φ = 0.272**. Ang top item:

```
eng>fao · claude-haiku-4.5 · naive
  edge_strength        0.0      (no published eng→fao runs)
  pair_prior           0.613    basis: target-language (Faroese runs exist via dan→fao)
  model_offset        −0.114    (haiku trails other models on shared pairs)
  condition_offset     0.0      (no coaching evidence for fao)
  exploration_bonus   +0.174    (never-run cell: κ·√(2·ln 425 / 1))
  predicted_strength   0.673
  expected_mesh_gain   0.0181   (eng→fao is a near-component join)
  est_cost_usd         0.0101
  ecv_per_usd          1.79     ← rank #1
```

Basahin ito pabalik: ang Faroese ay nakakonekta sa mesh sa pamamagitan lamang ng Danish, kaya
ang isang measured eng→fao edge ay nagsho-shortcut ng napakalaking pamilya ng chains (ang malaking
ΔΦ); ang model ay napredict na mid-pack sa pair na tulad nito (prior +
offset), wala pang sinuman ang sumubok sa cell na ito (malaking bonus), at ang run
ay nagkakahalaga ng isang sentimo. Wala nang iba pa sa queue ang nakakabili ng mas maraming mesh per dollar.
Ang parehong arithmetic, na inilalathala ang bawat input, ang lumilikha ng bawat iba pang
rank.

## 6. Mga kilalang limitasyon (at ano ang mag-aayos sa mga ito)

1. **Hindi comparable ang chrF++ sa iba't ibang wika.** Pinagagalaw ng morphology ang
   scale; ang 0.5 edge papasok sa Basque ay hindi parehong achievement tulad ng papasok sa
   Dutch. Mitigation: ang priorities ay pinangingibabawan ng *structure* (s = 0 →
   s > 0 transitions) kung saan second-order ang scale effects. Fix:
   per-language score normalization, o metrics na may mas mahusay na
   cross-lingual calibration habang nagiging available ang mga ito para sa mga
   wikang ito.
2. **Ang product-λ chain model ay prior, hindi measurement.** Directionally
   suportado ito ng pivot literature ngunit hindi pa calibrated
   para sa LLM translation. Fix (planned): ang mesh ay mayroon na ngayong measured
   triangles (hal. deu→fra direct kasabay ng deu→eng→fra), kaya ang chained
   output ay maaaring direktang ma-score at ang λ ay mai-fit sa data sa halip na piliin lamang.
3. **Contamination at dev-set status.** Namamana ng edge strengths ang bawat
   caveat ng public development sets — ituring ang Φ bilang upper-bound
   planning signal, hindi kailanman capability claim
   ([Corpus Design](/docs/network/specifications/corpus-design)).
4. **Domain blindness.** Ang edge na nasukat sa conversational text ay
   itinuturing bilang isang numero; ang mga chain na tumatawid sa domains ay mas hihina
   kaysa sa hinuhulaan ng λ.
5. **Directionality.** Ang mga edge ay kasalukuyang undirected (X→Y evidence
   lights X↔Y). Kapag ang chain composition ay naging direction-sensitive sa
   praktika, hahatiin ang strengths ayon sa direksyon — hindi nagbabago ang formula,
   dodoble lang ang graph.

## 7. Mga sanggunian

- Latora, V. & Marchiori, M. (2001). *Efficient Behavior of
  Small-World Networks.* Physical Review Letters 87, 198701.
  [arXiv:cond-mat/0101396](https://arxiv.org/abs/cond-mat/0101396)
- Auer, P., Cesa-Bianchi, N. & Fischer, P. (2002). *Finite-time
  Analysis of the Multiarmed Bandit Problem.* Machine Learning 47,
  235–256. [doi:10.1023/A:1013689704352](https://link.springer.com/article/10.1023/A:1013689704352)
- Nemhauser, G., Wolsey, L. & Fisher, M. (1978). *An Analysis of
  Approximations for Maximizing Submodular Set Functions—I.*
  Mathematical Programming 14, 265–294.
  [doi:10.1007/BF01588971](https://link.springer.com/article/10.1007/BF01588971)
- Khuller, S., Moss, A. & Naor, J. (1999). *The Budgeted Maximum
  Coverage Problem.* Information Processing Letters 70(1), 39–45.
  [doi:10.1016/S0020-0190(99)00031-9](https://dl.acm.org/doi/10.1016/S0020-0190(99)00031-9)
- Utiyama, M. & Isahara, H. (2007). *A Comparison of Pivot Methods for
  Phrase-Based Statistical Machine Translation.* HLT-NAACL 2007,
  484–491. [ACL Anthology N07-1061](https://aclanthology.org/N07-1061/)
- Wu, H. & Wang, H. (2007). *Pivot Language Approach for Phrase-Based
  Statistical Machine Translation.* ACL 2007; journal version Machine
  Translation 21(3), 165–181.
  [doi:10.1007/s10590-008-9041-6](https://link.springer.com/article/10.1007/s10590-008-9041-6)
- Paul, M., Yamamoto, H., Sumita, E. & Nakamura, S. (2009). *On the
  Importance of Pivot Language Selection for Statistical Machine
  Translation.* NAACL-HLT 2009 Short Papers, 221–224.
  [ACL Anthology N09-2056](https://aclanthology.org/N09-2056/)
- Haffari, G., Roy, M. & Sarkar, A. (2009). *Active Learning for
  Statistical Phrase-Based Machine Translation.* NAACL-HLT 2009,
  415–423. [ACL Anthology N09-1047](https://aclanthology.org/N09-1047/)
- Fan, A. et al. (2021). *Beyond English-Centric Multilingual Machine
  Translation.* Journal of Machine Learning Research 22(107), 1–48.
  [arXiv:2010.11125](https://arxiv.org/abs/2010.11125)
