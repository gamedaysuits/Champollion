---
sidebar_position: 1
title: "Mga Panuntunan sa Pagsumite"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How runs are scored: chrF++ with its CI and signature"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "The rules, applied"
---

# MT Evaluation

> **Pangkalahatang Buod.** Tinutukoy ng pahinang ito ang pamantayan sa pagsusumite sa leaderboard, pagmamarka (chrF++ bilang headline, kasama ang karaniwang mga sukatan at diagnostic sa tabi nito), mga patakaran laban sa manipulasyon (anti-gaming), mga antas ng beripikasyon, at ang daloy ng trabaho sa pagsusumite. Ang mga pamamaraang nalantad sa datos ng pagsusuri ay madidiskwalipika.

Kasama sa champollion ang isang machine translation evaluation framework na idinisenyo para sa **reproducible benchmarking** ng mga translation method — lalo na para sa mga low-resource at Katutubong wika kung saan walang karaniwang MT benchmark at mahirap beripikahin ang mga claim sa kalidad.

---

## Ang Leaderboard

Ang sentro nito ay ang **[Method Leaderboard](https://champollion.dev/leaderboard)** — isang pampublikong scoreboard, live at **bukas para sa mga pagsusumite**, kung saan ang mga mananaliksik at miyembro ng komunidad ay nagpapadala at naghahambing ng mga pamamaraan sa pagsasalin na may fingerprinted at mapagkakatiwalaang nauulit (reproducible) na ebalwasyon.

Kasama sa bawat submission ang:

- **Fingerprinted pipeline** — nakatali sa isang partikular na Git commit at config hash, upang ang mga resulta ay maitunton pabalik sa eksaktong code na lumikha sa mga ito
- **May bersyong dataset (Versioned dataset)** — naka-content-hash at may bersyon; maikukumpara lamang ang mga marka sa loob ng parehong bersyon ng dataset
- **Mga pamantayang sukatan (Standardised metrics)** — ang lahat ng pagmamarka ay kinakalkula ng pinagsasaluhang evaluation harness, na nag-aalis ng mga pagkakaiba sa pagpapatupad
- **Mga antas ng tiwala (Trust tiers)** — self-benchmarked, Champollion Verified, o Community Validated
- **Pagsubaybay sa gastusin (Cost tracking)** — gastusin sa API bawat pagsusumite, upang maging malinaw ang mga kapalitang cost–quality

Iniraranggwa ng leaderboard ang mga run sa paraang katulad ng pag-uulat ng ebalwasyon ng MT ng WMT, FLORES-200, at mga shared task ng AmericasNLP: sa pamamagitan ng **isang karaniwang sukatan, ang chrF++**, na ipinapakita kasama ang 95% confidence interval nito at signature ng sacreBLEU — halimbawa `chrF++ 47.5 [45.9, 49.0]`. Ang iba pa ay ipinapakita sa tabi nito, kailanman ay hindi inihahalo rito:

| Sukatan | Papel | Kung Ano ang Sinusukat Nito |
|--------|------|------------------|
| **chrF++** | **Pangunahing sukatan sa pagraranggo (Headline)** | Character n-gram F-score laban sa sanggunian (reference) (sacreBLEU, `word_order=2`). Mas mahusay sa masaganang morpolohiya kaysa sa mga sukatan sa antas ng salita |
| **BLEU, spBLEU, TER, COMET** | Karaniwang mga sukatan, katabi ng headline | Ang iba pang mga sukatang iniuulat sa mga papel ng MT; COMET kapag nakalkula ito, kasama ang model id nito |
| **Exact Match** | Diagnostic | Gaano kadalas eksaktong katulad ng sanggunian ang salin |
| **FST Acceptance** | Diagnostic | Para sa mga wikang may finite-state transducer: anong proporsyon ng mga salita sa output ang mga wastong anyo. Hindi ito nagkukumpara sa pinagmulan o sanggunian, kaya hindi ito kailanman nagiging marka |
| **Equivalent Match** | Diagnostic | Bahaging tumutugma sa sanggunian o sa isang katanggap-tanggap na baryasyon (ayos ng salita, kombensiyon sa ortograpiya). Kasalukuyang CRK; pinapalawak pa. |
| **Semantic Score** | Diagnostic | Pagpapanatili ng kahulugan, sa pamamagitan ng isang deterministikong validator. Kasalukuyang CRK; pinapalawak pa. |
| **Mga babala sa marka (Score caveats)** | Ipinapakita sa tabi ng headline | Kapag kinokopya ng mga output ang kanilang pinagmulan, higit na mas maikli o mas mahaba kaysa sa mga sanggunian, inuulit ang isang output para sa maraming input, o ang mga row ng pagsubok ay may katambal sa datos ng pagsasanay |

Kung ang isang run ay mas mahusay kaysa sa isa pa ay pinagpapasyahan sa pamamagitan ng isang paired significance test sa chrF++, hindi sa pagkakasunod-sunod ng dalawang numero — ang mga nagsasapulungang (overlapping) interval ay isang babala na ang pagkakasunod-sunod ay maaaring ingay lamang ([Pagsusuri ng Estadistikal na Kabuluhan](/docs/network/specifications/significance)); ginagamit ng mga pagraranggo sa paligsahan ang pagsusuri upang bumuo ng mga kumpol ng ranggo (rank clusters). Iniraranggwa lamang ng chrF++ ang mga sistema sa parehong dataset, kailanman ay hindi sa magkaibang wika. Walang awtomatikong marka ang nagtataglay ng tatak ng kalidad — tanging pagsusuri lamang ng mga tagapagsalita ang nagpapatunay ng kalidad. Ang weighted composite at mga antas ng kalidad na ginamit noon ay retirado na; ang composite ng isang lumang card ay ipinapakita, kung mayroon man, bilang "legacy composite (retired)".

:::info[Kumpletong Koleksyon ng Sukatan]
Tinutukoy ng [Scoring Specification](/docs/network/specifications/scoring#how-runs-are-scored) kung paano minamarkahan ang mga run at ang kumpletong imbentaryo ng mga sukatan (anim na kategorya: surface, structural, semantic, behavioral, compliance, at iniulat na mga comparator).
:::

**[→ Tingnan ang leaderboard](https://champollion.dev/leaderboard)**

---

## Mga Available na Dataset

Ang mga bagay kung saan maaaring markahan ang isang run ay nakalista sa mga tool, kaya ang pahinang ito ay walang sariling listahan:

```bash
# the runnable corpora for a pair: size, contamination, domain, licence, provider
mt-eval corpora --source eng --target crk

# …and the catalogued ones that can never run, each with its reason
mt-eval corpora --source eng --target crk --include-quarantined
```

Inilalarawan ng pahina ng [Mga Evaluation Dataset](/docs/network/leaderboard/datasets)
ang katalogo, ang format ng corpus, ang mga antas ng kahirapan, ang mga linya ng lisensya,
at kung paano lumikha ng inyong sarili. Tatlong panuntunan mula sa katalogong iyon ang nagpapasya kung ano ang maaaring
magkaroon ng ranggo:

- **Kailanman ay hindi nagraranggo ang isang naka-quarantine na corpus.** Nakalista ito sa katalogo ngunit hindi kailanman maaaring patakbuhin,
  at tatanggihan ng database ang anumang markang ipapaskil laban dito. Ang mga corpus ng EdTeKLA para sa
  English→Plains Cree (`eval-eng-crk-edtekla-dev-v1` at
  `eval-eng-crk-edtekla-textbook`) ay naka-quarantine. Nagtataglay ang mga ito ng binago at may saklaw na soberanya na CC BY-NC-SA
  (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`) at ibinukod mula sa bawat
  leaderboard, premyo, at komersyal na linya.
- **Pang-relatibo lamang ang ranggo ng isang kontaminadong corpus.** Ang FLORES+, at anumang corpus
  na may gradong `HIGH` o `MEDIUM` para sa kontaminasyon o hindi nagawaran ng grado, ay
  tinatatakan ng relative-comparison-only sa run card nito. Inihahambing nito ang mga pamamaraang pinatakbo
  sa corpus na iyon at kailanman ay hindi iniuulat bilang ganap na kalidad. Tanging ang corpus lamang
  na may gradong `LOW` ang nagraranggo batay sa ganap na kalidad.
- **Nananatili ang mga linya ng lisensya.** Ang isang di-komersyal na corpus ay nananatiling hiwalay sa mga komersyal at
  pampremyong landas. Ang isang corpus na nasa ilalim ng binago, pasadyang, o hindi nakasaad na pahintulot ay tatanggi sa
  ebalwasyon sa remote model-API hanggang sa maitala ang pahintulot ng may-ari ng karapatan
  sa talaan nito.

**Tumatakbo ang mga paligsahan sa mga selyadong set na itinatago ng punong-abala (host).** Ang isang paligsahan ay hindi minamarkahan sa
alinman sa mga pampublikong corpus na ito. Ang punong-abala, isang komunidad, o isang organisasyon, ay nagtatago
ng isang selyado at pinigil (held-out) na test set sa sarili nitong imprastraktura. Kwalipikado ang mga kalahok sa
pampublikong dev set na inilalabas ng punong-abala, pagkatapos ay ibibigay sa node ng punong-abala ang isang modelo o isang
pamamaraan upang patakbuhin. Pinapahintulutan ng mga tagapangalaga ng punong-abala ang bawat run, at mga marka lamang
ang inilalabas. Tingnan ang [Magpatakbo ng Isang Soberanong Paligsahan](/docs/network/sovereignty/run-a-sovereign-contest).

:::danger[HUWAG MAG-TRAIN sa datos ng pagsusuri]

**Ang mga dataset na ito ay para lamang sa evaluation.** Ang mga method na na-train, na-fine-tune, na-few-shot-prompt, o sa anumang paraan ay na-expose sa evaluation data ay magbubunga ng artipisyal na pinataas na mga score at **madidiskuwalipika mula sa leaderboard.**

Hindi ito mungkahi — ito ang nag-iisang pinakamahalagang tuntunin ng integridad ng evaluation. Gumamit ng hiwalay na corpora para sa training. Dapat manatiling hindi nakikita ng inyong model ang mga evaluation set habang nasa development.

Kung gumagamit kayo ng coaching data o few-shot examples, dapat manggaling ang mga iyon sa **ganap na hiwalay na mga source**. Kung may alinlangan, huwag itong isama.
:::

:::warning[Non-determinism ng LLM]

Non-deterministic ang mga LLM output. Kinakatawan ng mga score ang point-in-time measurements sa ilalim ng partikular na model versions at API configurations. Maaaring i-update ng mga model provider ang weights, decoding strategies, o safety filters anumang oras, na maaaring magdulot ng score drift sa pagitan ng mga run. Itinatala ng leaderboard ang eksaktong model slug at timestamp para sa bawat submission.
:::

---

## Ano ang Bumubuo sa Isang Mahusay na Method

Hindi pantay-pantay ang lahat ng method. Narito ang naghihiwalay sa masusing gawa mula sa mga pinalobong score.

### Mga katangian ng isang matibay na method

- **Malinis na paghihiwalay ng train at eval data** — hindi kailanman nakita ng inyong method ang evaluation set habang nasa development, tuning, prompt engineering, o pagpili ng few-shot example
- **Reproducible** — maaaring i-clone ng ibang tao ang inyong repo, patakbuhin ang harness, at makuha ang parehong mga score (sa loob ng hangganan ng LLM non-determinism)
- **Documented** — inilalarawan ng inyong [method card](/docs/network/specifications/methods) kung ano ang ginagawa ng inyong method, anong tools ang ginagamit nito, at ano ang mga limitasyon nito
- **Tapat tungkol sa scope** — kung gumagana lamang ang inyong method para sa isang language pair, sabihin ito; kung bumababa ang performance nito sa ilang morphological pattern, i-document iyon
- **May kamalayan sa komunidad** — para sa mga Katutubong wika, iginagalang ng inyong method ang data sovereignty. Kumonsulta kayo sa mga language community o gumamit lamang ng openly licensed data

### Mga red flag (ano ang nagdudulot ng disqualification)

| Red Flag | Bakit Ito Problema |
|----------|--------------------|
| Training sa eval data | Ganap na binabalewala ang layunin ng evaluation. Nililinlang ng pinalobong score ang lahat. |
| Cherry-picking ng mga resulta | Pagpapatakbo nang 10 beses at pagsusumite ng pinakamahusay na run nang hindi idinedeklara ang iba |
| Hindi idineklarang post-processing | Manu-manong pag-aayos ng mga output bago ang scoring |
| Kontaminadong coaching data | Paggamit ng mga halimbawa mula sa eval set bilang few-shot prompts o dictionary entries |
| Pag-claim ng commercial readiness nang walang provenance | Kung gumagamit ang inyong method ng CC BY-NC-SA data, hindi ito commercially ready |

### Mga verification tier

Inilalarawan ng mga antas ng beripikasyon kung **sino ang nagpatunay sa resulta**. Hindi ang mga ito mga tatak ng kalidad (ang mga lumang awtomatikong antas ng kalidad ay [retirado na](/docs/network/specifications/scoring#5-quality-tiers)).

| Antas | Kahulugan | Paano Ito Makukuha |
|------|---------|--------------|
| **Self-benchmarked** | Kayo mismo ang nagpatakbo ng harness at nagsumite ng mga resulta | I-publish ang inyong run card gamit ang `mt-eval publish` |
| **Champollion Verified** | Independyenteng muling minarkahan ng proyekto ang inyong mga isinumiteng output laban sa sha-pinned reference corpus at naulit (reproduced) ang inyong marka | Ang re-scorer ay isang tool ng tagapangalaga (maintainer), manu-manong pinapatakbo bilang isang batch. Walang nag-iiskedyul dito, kaya walang pagsusumite na muling minamarkahan sa pagdating (tingnan sa ibaba) |
| **Community Validated** | Sinuri ng mga bilingguwal na tagapagsalita ng target na wika, na kwalipikado sa ilalim ng sariling protocol ng komunidad, ang isang stratified sample ng output (≥30 entry, ≥2 tagasuri) at ≥70% ang umabot sa pamantayan ng komunidad. Iginagawad lamang sa pamamagitan ng sariling pagsubok ng komunidad; ang pagbaba ng antas sa pamamagitan ng spot-audit ay simetriko | Isumite ang method code sa organisasyon ng pamamahala — patatakbuhin nila ito laban sa gold-standard set at isusumite ang output sa pagsusuri ng komunidad |

**Ang pagpapasyang Community-validated ay isang hiwalay na linya, at wala pang mga marka ng pagsusuri ng tao sa kasalukuyan:** kayang piliin ng harness kung aling mga sistema ang masasaklaw ng isang nakatakdang badyet sa pagsusuri ng tao mula sa na-freeze na pagraranggo ng isang saradong paligsahan (buong mga tie group lamang — kailanman ay hindi hinahati ang isang kumpol), ngunit hindi ito nagtatala ng mga rating, at wala sa leaderboard ngayon ang nagtataglay ng pagpapasiya ng tao.

**Ang mga ranggo ay mga kumpol, hindi isang mahigpit na pagkakasunod-sunod.** Ang mga magkakatabing entry na hindi mapaghihiwalay ng significance test ay nagbabahagi ng iisang ranggo at nagtataglay ng *saklaw* ng ranggo (rank range); sa isang selyadong paligsahan, kung saan ang bawat-segment na output ay hindi kailanman lumalabas sa makina ng tagapag-ayos, ang paired test ay tumatakbo sa makinang iyon at ang mga nilagdaang hatol lamang nito ang lumalabas; kung wala ang mga ito, nakasalalay ang mga tabla (ties) sa ebidensya ng confidence-interval o point-equality. Kung paano ito gumagana, at kung gaano kahina ang bawat baytang ng hagdan ng ebidensya, ay nakasaad sa [Pagsusuri ng Estadistikal na Kabuluhan → Mga kumpol ng pagraranggo](/docs/network/specifications/significance#ranking-clusters).

### Paano sumusukat ang beripikasyon: pag-audit na tinimbang ng reputasyon

**Hindi kami naggigiit ng pinagmulan (provenance).** Ang isang row sa leaderboard ay nilikha ng isang kontribyutor
na nagpapatakbo ng *open-source* na harness sa kanilang *sariling* makina. Ang "Ang run na ito ay tunay na dumaan
sa harness" ay hindi isang bagay na maaaring mapatunayan ng isang server para sa self-hosted
na pag-compute — ang signing key ng harness ay nasa mga kamay ng kontribyutor, kaya ang isang
lagda ay nagpapatunay ng isang *makina, hindi ng katapatan*. Sa halip na magpanggap
nang taliwas, **ang bisa rito ay pinaghihirapan at nagwawasto sa sarili**: ang isang row ay mapagkakatiwalaan
dahil ang marka nito ay **nauulit (reproducible)** at dahil ang kontribyutor sa likod nito ay
**nagsugal ng isang reputasyon na mawawasak kapag nahuli ang gawa-gawang datos.** Isinasagawa
ang beripikasyon sa apat na antas, kaya masusi ito kung saan kailangan at mura kung saan maaari
— hindi na kailangang patakbuhin muli ng proyekto ang gawa ng lahat.

- **L0 — muling markahan ang lahat (libre, ~100%).** Muling hinahango ng re-scorer ang inyong
  marka mula sa *inyong sariling mga isinumiteng output* laban sa **sha-pinned reference
  corpus** (hindi ang inyong nakaimbak na kopya nito), gamit ang parehong sukatang ginagamit ng harness.
  Kung hindi maulit ang marka mula sa mga output, o binago ang isang nakaimbak na sanggunian, ang run ay
  **madidiskwalipika** — ito pa lamang ay pumipigil na sa isang mano-manong inilagay o inedit
  na marka. Ang isang run na matagumpay na nauulit ay itinataas sa **Champollion Verified** — ang
  antas na ginagamit ng pagraranggo sa paligsahan bilang default, at ang tanging antas na kwalipikado para sa isang
  premyo. Naitayo na ito at ito ay mura, ngunit ito ay isang **utos ng tagapangalaga (maintainer command), na manu-manong
  pinapatakbo**: walang nagpapatakbo nito sa pagsusumite, at walang nag-iiskedyul nito. Hangga't hindi
  nagbabago iyon, ang bawat row ay dumarating — at nananatiling — self-benchmarked.
- **L1 — isang hagdan ng reputasyon ng kontribyutor.** Ang bawat kontribyutor (natutukoy sa pamamagitan ng kanilang
  pag-sign in) ay nagkakamit ng reputasyon *lamang* sa pamamagitan ng pagpasa sa mas malalalim na pagsusuri sa ibaba — kailanman
  ay hindi sa pamamagitan ng dami lamang, kaya walang saysay ang paggawa ng mga bagong pagkakakilanlan. Ang reputasyon ay
  **pampubliko**, at ito ang nagpapasya kung gaano kadalas isasagawa ang magastos na pagsusuri.
- **L2 — muling patakbuhin ang isang *sample* (ang magastos na pagsusuri; patakaran lamang, wala pang re-runner
  sa ngayon).** Para sa isang *pampublikong* development set, hindi mahuhuli ng L0 ang isang kontribyutor na
  kinokopya lamang ang sanggunian bilang kanilang "salin." Ang paghuli doon ay nangangailangan
  ng aktuwal na muling pagpapatakbo ng modelo — tunay na compute — kaya gagawin namin ito sa isang
  **sample**, hindi sa lahat. Ang **patakaran sa pag-sample** ay naitayo at nasubukan na: ang isang
  run ay pinipili na may probabilidad na tumataas kasabay ng **nakataya (stakes)** (ang isang run na
  nagsisilbing unang tulay sa isang buong pamilya ng wika ay *palaging* pinipili),
  tumataas kasabay ng **anomaliya** (ang isang napakagandang paglukso mula sa dating pinakamahusay na mahirap paniwalaan ay
  *palaging* pinipili), at bumababa kasabay ng **reputasyon** (ang isang kontribyutor na
  nakapasa na sa maraming audit ay madalang na i-spot-check; ang isang baguhan o di-nagpakilalang tagapagsumite
  ay sinusuri sa bawat run hanggang sa makamit nila ang tiwala). Ang pagpasa sa isang L2 audit
  ay nagtataas ng reputasyon. **Wala pa ang re-runner na pamamahalaan ng patakarang iyon**,
  kaya wala pang L2 audit na naisagawa kailanman: ang isang napiling run ay naitatala bilang *L2-pending*.
- **L3 — pagpapatotoo (corroboration) (libreng beripikasyon).** Kapag ang dalawang *independiyenteng* kontribyutor
  ay nagpatakbo ng parehong modelo sa parehong corpus at ang kanilang muling minarkahang mga output ay **nagkakatugma**,
  ang pagkakatugmang iyon *ang* beripikasyon — at nagpapataas ito sa reputasyon nilang dalawa. Ang isang tunay
  na **di-pagkakatugma** ay nagmamarka sa parehong run para sa isang L2 audit. Ang replikasyon ay
  ginagantimpalaan sa halip na ituring na kalabisan.

**Ang isang nahuling palsipikasyon ay kapaha-pahamak — katulad ng isang pagbawi (retraction).** Ang isang napatunayang
palsipikasyon ay nag-aalis sa zero ng reputasyon ng kontribyutor, **muling nag-aaudit sa kanilang buong
napatunayang kasaysayan** (bawat isa sa kanilang mga napatunayang run ay ibinabalik sa
beripikasyon), at itinatala nang **hayagan** sa audit log. Iyan ang dahilan kung bakit ligtas
ang magaang pag-sample: ang pandaraya sa isang pampublikong dev set ay maaaring makalusot sa isang run, ngunit
ang inaasahang pinsala — ang mawala ang lahat ng pinaghirapang tiwala at muling suriin ang inyong buong
talaan — ay ginagawa itong isang masamang desisyon. Ang mga panuntunang ito ay sumasaklaw rin sa sariling
mga run ng mga tagapangalaga nang simetriko.

**Bakit sulit pa rin ang pag-ambag.** Kayo ang palaging nagbabayad para sa magastos na bahagi
(pagpapatakbo ng inyong pamamaraan); binabayaran lamang ng proyekto ang libreng L0 re-score para sa lahat
kasama ang isang L2 re-run sa isang *lumiliit na sample* — mataas para sa mga baguhan at mga run na may mataas
na nakataya, mababa para sa mga napatunayang kontribyutor. Ang gastusin sa beripikasyon ay *ina-amortize sa pamamagitan ng reputasyon
at pinagsasaluhan sa pamamagitan ng corroboration*, hindi muling binabayaran nang buo sa bawat pagkakataon.

---

## Paano Magsumite

1. **Buuin ang inyong pamamaraan** — tingnan ang [Pagbuo ng Pamamaraan](/docs/network/specifications/methods) para sa interface ng pamamaraan
2. **Patakbuhin ang harness** — tingnan ang [Eval Harness](/docs/network/specifications/harness) para sa pag-setup at paggamit
3. **Bumuo ng run card** — gumagawa ang harness ng isang JSON run card kasama ang inyong mga marka, fingerprint, at metadata
4. **I-publish** — ina-upload ng `mt-eval publish eval/logs/harness/<run-id>_report.json --prod` ang run card sa leaderboard (mag-preview gamit ang `--dry-run`)
5. **Lumitaw sa leaderboard** — nakalista ang inyong run bilang *self-benchmarked (unverified)*. Inililista at iniraranggwa ng [Method Leaderboard](https://champollion.dev/leaderboard) ang bawat row na hindi `disqualified`, kasama ang mga self-benchmarked at may tatak na ganoon; mag-filter sa *Champollion Verified* upang makita lamang ang mga muling minarkahang resulta. Ang L0 re-score na nag-aangat sa isang run patungo sa antas na iyon ay isang batch ng tagapangalaga, at walang nag-iiskedyul dito, kaya sa ngayon ang bawat row sa board ay isang sariling-iniulat na pahayag. Ang Verified-only ang default para sa isang pagraranggo sa **paligsahan**, at ito ang tanging antas na kwalipikado para sa isang premyo

---

## Patakaran sa Integridad: Mga Pagbawi, Muling Pagpapatakbo, Pag-aalis sa Talaan, Mga Pagtatalo

Isinulat nang maaga upang ang pagpapatupad ay maging pamamaraan, hindi drama. Ang mga panuntunang ito
ay sumasaklaw sa lahat nang simetriko — kabilang ang sariling mga run ng mga tagapangalaga.

**Walang mga pagbawi (retractions).** Ang isang na-publish na run ay isang permanenteng tala. Walang
mekanismo — para sa sinuman — upang magbura ng marka dahil ito ay nakakahiya.
Bawat row ng run ay nagtataglay ng server-stamped na `submitted_at` timestamp at isang
hindi nababagong audit trail; ang mismong mga aksyon sa pagmo-moderate ay naitatala rin.

**Nagdaragdag ang mga muling pagpapatakbo, kailanman ay hindi nagpapalit.** Kung mapapabuti ninyo ang inyong pamamaraan, mag-publish ng isang bagong
run. Nananatili ang lumang run. Ang mapiling paghahayag (selective disclosure) — ang pribadong pagsubok sa maraming
baryasyon at pag-publish lamang sa nanalo — ang dahilan kung bakit napaglalalangan ang ibang mga leaderboard;
ang append-only na talaan ang estruktural na kasagutan. Pinipigilan ng de-duplication gamit ang fingerprint
ang spam na muling pagsusumite ng eksaktong parehong byte; kailanman ay hindi nito muling isinusulat
ang kasaysayan.

**Ang pag-aalis sa talaan (delisting) ay pagpapatupad ng panuntunan, kung saan pinapangalanan ang panuntunan.** Ang isang run ay inaalis sa talaan
(minamarkahang `disqualified`, nang hayag — hindi tahimik na tinatanggal) para lamang sa mga nakalistang
dahilan: isang naka-quarantine o hindi wastong subset na dataset (ipinapatupad ng database
trigger sa ilalim ng bawat client), mismatch sa checksum ng corpus, gawa-gawa o wala sa saklaw na mga marka,
mga paglabag sa content-guard, o pagbawi ng tagapangasiwa (steward) sa rehistrasyon ng
pinagbabatayang datos. Tinutukoy sa pag-aalis sa talaan ang panuntunan at ang ebidensya. Ang mga bagong dahilan ay idinaragdag dito
sa pamamagitan ng may-petsang pag-edit bago pa man ipatupad ang mga ito, kailanman ay hindi retroaktibong iniimbento para sa iisang kaso.

### Pag-flag ng isang resulta

*Idinagdag noong 2026-09-07.*

:::caution[Hindi pa tumatanggap ng mga flag]

Naitayo na ang pag-flag, at handa na ang database para dito simula noong 2026-09-07 — ngunit ang
form na nagpapadala ng flag ay hindi pa muling nade-deploy laban dito, kaya hindi
pa rin makapagsumite ang *I-flag ang resultang ito*. Nabibigo ito sa halip na tanggapin ang flag nang tahimik.
Mag-email sa `info@champollion.dev` pansamantala. Aalisin ang abisong ito sa araw
na mailabas ang form.

:::

**Kahit sino ay maaaring mag-flag ng resulta.** I-expand ang row nito sa leaderboard at gamitin ang *I-flag
ang resultang ito*: magbubukas ito ng form ng mensahe na nakatali na sa id ng run na iyon, at sasabihin
ninyo kung ano sa palagay ninyo ang mali at paano ninyo nalaman — isang kontaminadong corpus, isang
sukatan na hindi tumutugma sa label nito, isang maling naiugnay na pamamaraan, o anupaman. Ang isang
flag ay kailangang magbigay ng dahilan. Ang flag na walang dahilan ay isang downvote, at ang board na ito
ay walang mga downvote.

**Ang isang flag ay isang pribadong mensahe, hindi isang boto.** Dumarating ito sa mga tagapangalaga bilang isang
tiket at hindi napupunta sa iba. Walang bilang ng mga flag ang ipinapakita kailanman — hindi sa
row, hindi sa run card, saanman — dahil ang isang nakikitang bilang ay maaaring
samantalahin, at ang katayuan ng isang resulta ay kailangang nakasalalay sa ebidensya sa halip na sa
kung gaano karaming tao ang tumutol. Ang pagsusumite ng flag, sa sarili nito, ay walang binabago sa
row.

**Ang isang pinagtibay na flag ay lumalabas sa eksaktong isang paraan:** minamarkahan ang resulta bilang
`disqualified`, para sa isang dahilang nakalista na sa pahinang ito. Tulad ng bawat iba pang
pag-aalis sa talaan, may idinaragdag na bagong dahilan dito **sa pamamagitan ng may-petsang pag-edit bago ito ipatupad sa
kanino man** — kaya kailanman ay hindi makagagawa ang isang flag ng lihim na panuntunan o retroaktibong panuntunan. Kung ang
flag ay hindi pinagtibay, mananatiling walang pagbabago ang row, at kung nag-iwan kayo ng address ay makatatanggap kayo
ng sagot sa alinmang sitwasyon.

**Ang mga antas ng tiwala ay mga label, hindi mga pag-edit.** Ang mga row na `self-benchmarked` ay mga pahayag;
ang mga row na `Champollion Verified` ay independiyenteng muling minarkahan mula sa
mga output ng nagsumite laban sa sha-pinned na corpus; ang `Community Validated` ay
iginagawad lamang sa pamamagitan ng sariling pagsubok ng komunidad. Binabago ng beripikasyon ang
antas ng isang row — kailanman ay hindi nito binabago ang mga marka ng row.

**Pampubliko at nagwawasto sa sarili ang reputasyon.** Ang reputasyon ng kontribyutor, at ang
audit log na nagtatala ng bawat muling pagmamarka, na-sample na muling pagpapatakbo, corroboration, at
pagbura dahil sa palsipikasyon, ay pampubliko. Ang reputasyon ay hindi isang score multiplier at hindi
kailanman sumasaling sa mga numero ng isang run — itinatakda lamang nito kung gaano kadalas muling ina-audit ang mga run ng isang kontribyutor
(tingnan ang *pag-audit na tinimbang ng reputasyon* sa itaas). Ang isang napatunayang palsipikasyon ay
itinatala nang hayagan tulad ng isang pagbawi at muling ina-audit ang buong napatunayang kasaysayan ng kontribyutor;
ang parehong mga panuntunan ay nalalapat sa sariling mga run ng mga tagapangalaga.

**Mga Pagtatalo.** Magbukas ng isang issue kasama ang run id at ang partikular na pahayag (maling
marka, maling dataset, maling naipatupad na panuntunan). Muling patatakbuhin ng mga tagapangalaga ang
mga deterministikong pagsusuri sa publiko; ang kinalabasan at ang ebidensya nito ay ilalagay sa
issue. Kung ang pagtatalo ay tungkol sa datos o pagpapatunay ng isang komunidad, ang sariling
awtoridad ng komunidad ang magpapasya at ipapatupad ng board ang kanilang desisyon.
Para sa mga paligsahan na may premyo, nalalapat ang parehong mga panuntunan kasama ang paunang nai-publish na mga hakbang
sa kwalipikasyon at pag-audit ng paligsahan — ina-audit ang mga nanalo **bago** ang pagbabayad, at ang
isang diskwalipikasyon ay bumabanggit sa panuntunan eksakto tulad ng anumang iba pang pag-aalis sa talaan.

## Mga Direksiyon sa Hinaharap

- **Comprehensive model comparison runs** — sistematikong evaluation ng frontier models (GPT-4o, Claude, Gemini, atbp.) sa mga wika ng champollion gamit ang custom evaluation corpora (hindi mga pampublikong benchmark)
- **Mas maraming language pair** — Quechua, Inuktitut, at iba pang low-resource languages habang nagiging available ang mga community-verified dataset
- **Dataset import** — tooling upang i-convert ang external evaluation datasets (WMT, Tatoeba, atbp.) sa champollion evaluation format
- **Automated re-runs** — pag-detect ng mga pagbabago sa model version at muling pagpapatakbo ng benchmarks upang i-track ang score drift

---

## Tingnan Din

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — mga live na marka at pagsusumite
- **[Eval Harness](/docs/network/specifications/harness)** — kung paano magpatakbo ng mga ebalwasyon
- **[Mga Evaluation Dataset](/docs/network/leaderboard/datasets)** — format ng dataset at magagamit na mga dataset
- **[Pagbuo ng Pamamaraan](/docs/network/specifications/methods)** — ang detalye ng interface ng pamamaraan
- **[Detalye ng Run Card](/docs/network/specifications/run-card)** — ang JSON schema ng run card
- **[Detalye ng Benchmark](/docs/network/specifications/benchmark)** — protocol ng ebalwasyon, format ng corpus, soberanya
- **[Detalye ng Pagmamarka](/docs/network/specifications/scoring)** — SSOT para sa mga sukatan at kung paano minamarkahan ang mga run
