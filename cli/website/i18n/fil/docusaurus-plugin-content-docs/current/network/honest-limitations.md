---
title: "Mga teknikal na limitasyon"
description: "Ang hindi (pa) inaangkin ng Champollion, na inilahad nang tumpak: ang mga limitasyon ng morpolohikal na pagpapatunay, mga antas ng tiwala batay sa sariling ulat, pagpapatunay ng tagapagsalita, pangangalaga sa selyadong pagsubok, at kung bakit walang ibinibigay na antas ng kumpiyansa sa bawat pangungusap."
---

# Mga teknikal na limitasyon

> **Bago rito?** Sinasabi sa [Kung ano ang hindi pa nito kayang gawin](/docs/what-it-cant-do-yet)
> ang parehong mga bagay sa payak na pananalita. Ang pahinang ito ang tiyak na bersyon, para sa
> mga developer, mananaliksik, at mga agent.

Ito ang mga pahayag na **hindi** namin lalampasan. Kung mayroon mang anuman sa ibang bahagi ng
site na ito na nagpapahiwatig nang higit pa sa nakasulat dito, ituring ito bilang isang bug at
[ipagbigay-alam sa amin](/docs/network/perspectives/reporting-errors-and-owning-corrections).

Nakakakuha lamang ng tiwala ang evaluation infrastructure sa pagiging tapat tungkol sa mga hangganan nito. Narito
ang sa amin, ipinahayag nang sapat na malinaw upang masuri.

## 1. Nakadepende ang malalim na morpolohikal na balidasyon sa isang FST *at* isang mararanggong test set

Ang FST-based na morpolohikal na balidasyon — ang pagsusuri na ang bawat salitang output ay isang
mahusay na nabuong salita sa target na wika — ay nangangailangan ng dalawang bagay para sa isang pares
ng wika: isang FST na naka-pin sa harness, at isang evaluation set para sa pares na
maaaring magranggo. Ang `GiellaLTFSTMetric` mismo ay **generic**: nag-iiskor ito ng anumang
wikang may naka-pin na GiellaLT FST (Plains Cree, mga wikang Sámi,
Finnish, Norwegian Bokmål, Inuktitut, at iba pa). Ilan sa mga wikang iyon
ay may mga bukas na evaluation set (Tatoeba, WMT, WMT24++) — inililista ng
[pahina ng mga dataset](/docs/network/leaderboard/datasets) ang katalogo,
inililista ng `mt-eval corpora --source eng --target <code>` kung ano ang maaaring patakbuhin para sa isang pares,
at inililista lamang ng `mt-eval corpora --with-fst` ang mga pares na ang target ay may
naka-pin na FST, kasama kung ito ay naka-install sa inyong makina.
Ang Plains Cree, ang wikang pinagsimulan ng gawain sa FST, ang eksepsiyon: ang
dalawang evaluation set nito (EdTeKLA) ay nakatalogo bilang mga naka-quarantine na label, at
tinatanggihan ng database ang anumang iskor na ipinaskil laban sa mga ito.

May dalawa pang limitasyon na nalalapat. Kung saan ang naka-pin na FST ay isa lamang spell-checking
na **acceptor** (Northern Sámi, Amharic, Basque), sinasabi nito kung umiiral ang isang salita
ngunit hindi kung ito ay wastong na-inflect, kaya hindi kinakalkula
ang `morphological_accuracy` — at tumatanggap ang isang acceptor ng ilang salitang Ingles at may malaking titik, kaya
ang pagtanggap ng FST ay maaaring magbigay ng kredito sa hindi naisaling output (ang run card ay magpapakita
ng babala ng source-copy; tingnan ang [mga babala sa iskor](/docs/network/specifications/scoring#2-8-score-caveats)). Ang pagtanggap ng FST ay isang diagnostic: hindi kailanman ito pumapasok sa headline ng chrF++ o nagraranggo ng isang run.
Nagbibigay rin ito ng kredito sa isang wastong pangungusap na inulit para sa bawat input; ang run card
ay magpapakita naman ng babala ng near-constant-output.
At bawat pares na walang FST ay iniiskoran gamit ang mga surface metric (chrF++, BLEU)
at mga behavioral check. Ang mga iyon ay kapaki-pakinabang na signal, ngunit **hindi**
ginagarantiya ng mga ito ang morpolohikal na kawastuhan. Hindi kami nag-aangkin ng morpolohikal na balidasyon
para sa anumang wikang walang parehong FST at isang evaluation set na maaaring magranggo.

## 2. Mga antas ng pagtitiwala: bawat row ay self-reported sa kasalukuyan {#2-trust-tiers-are-self-reported-at-launch}

Karamihan sa mga marka ay kinakalkula ng mga kontribyutor sa pamamagitan ng pagpapatakbo mismo ng harness at
paglalathala ng resulta. Ang **Pag-verify** — muling pagmamarka sa isang isinumite mula sa sarili nitong
mga output laban sa SHA-pinned na kanonikal na corpus — ay naitayo na, ngunit ito ay isang
command ng tagapangasiwa na pinatatakbo nang mano-mano: walang nagpapatakbo nito sa pagsusumite at walang
nag-iiskedyul nito, kaya sa kasalukuyan ang bawat row ay dumarating, at nananatiling, self-benchmarked
([Mga Panuntunan sa Pagsusumite](/docs/network/leaderboard/rules#verification-tiers)). Basahin
ang trust badge sa bawat row: **ang "self-reported" ay nangangahulugan nang eksakto niyan**, at ito
ang default.

## 3. Hindi pa nangyayari ang community speaker-validation

Ang iminumungkahing premyo ay nangangailangan ng **≥ 70% na pagtanggap mula sa mga bilingguwal na tagapagsalita** (walang premyong bukas). Tinukoy
ang gate na iyon, at ang mga kagamitan upang patakbuhin ito ay kasalukuyang ginagawa — ngunit **walang pagsusuri ng tagapagsalita ng komunidad
ang naisagawa**, at **walang marka sa site na ito ang nakapasa sa gate ng
tagapagsalita**. Ang chrF++ at bawat iba pang awtomatikong numero ay mga signal ng makina,
hindi isang hatol ng komunidad, kung kaya't walang marka rito ang may dalang label ng kalidad.

## 4. Umiiral ang evaluation sandbox at key ceremony; wala pang tagapangalagang gumamit sa mga ito

Kinukuha namin ang mga corpus mula sa kanilang pinagmulan at ini-SHA-pin ang mga ito, at ang mga held-out split ay
naka-seal. Kapag ang isang komunidad ay may hawak na lihim na test set, maaaring markahan ang isang pamamaraan
laban dito nang hindi kailanman umaalis ang set sa kanilang mga kamay — at ang ebalwasyong iyon
ay mayroon na ngayong **dalawang lane**. Ang
mas pinapaboran, para sa mga karaniwang neural model, ay **deklaratibo**: data lamang ang isinusumite
ng kalahok — mga safetensors weight + isang deklaratibong tokenizer + isang config —
at pinatatakbo ito ng tagapag-organisa sa kanilang sariling pinagkakatiwalaang inference engine
(`trust_remote_code=False`, offline; maluwag tungkol sa arkitektura dahil
ang kaligtasan ay nasa format na walang code, hindi sa pangalan ng arkitektura). Walang code ng kalahok ang tumatakbo
kahit kailan, kaya walang kailangang i-sandbox; ang pagsusuri sa kaligtasan ay isang mapagpapasyahang pagpapatunay ng format
(ito ba ay safetensors at hindi isang pickle? walang `trust_remote_code`?), hindi
isang pagtatangkang patunayan na ligtas ang arbitraryong code. Para sa mga pamamaraang tunay ngang code
(mga pipeline, mga LLM-coached na hybrid), ang fallback ay ang **sandbox**
na nakahiwalay sa network (mga static check, mga `--network=none` container, scores-only na egress, isang
opsyonal na true-airgap na file transport). Dahil walang network ang sandbox, tumatakbo
lamang doon ang isang pamamaraan nang kasama ang bawat model na tinatawagan nito sa loob ng bundle nito: dapat
ipadala ng isang LLM-coached na hybrid ang LLM nito bilang open weights, dahil ang isang naka-host na LLM API
ay hindi maabot. Nilalaman ng sandbox ang hindi pinagkakatiwalaang code sa halip
na tanggihang patakbuhin ito, kaya ito ang tapat-na-mas-mahinang lane — ang pangunahing garantiya nito
ay `--network=none` (hindi masusuri ng isang heuristic static scan ang isang binary na model),
at ipinagpaliban ang mas malalim na pagpapatibay (seccomp, mga microVM). Tingnan ang
[magpatakbo ng isang soberanong paligsahan](/docs/network/sovereignty/run-a-sovereign-contest)
para sa eksaktong kung ano ang live at kung ano ang hindi. Ang **key ceremony** ng offline node
**ay naitayo na** — ang set key ay hinahati nang M-of-N at muling pinagsasama-sama lamang sa memory sa panahon ng isang
pagpapatakbong pinahintulutan ng quorum — ngunit hindi pa ito kailanman nagamit kasama ng isang totoong custodian, at
ang mga share ay mga payak na file sa unang bersyong ito. Ang **hindi** pa naitatayo: threshold
signing (ang isang marka ay nilalagdaan ng isang solong node key) at hardware attestation (ang mga score
manifest ay nilalagdaan sa software lamang). Walang itinalagang custodian ng susi sa komunidad,
kaya ang gold-standard na ebalwasyon ng **premyo** ay nananatiling sarado hanggang sa
may mga custodian at pahintulot ng komunidad.

## 5. Hawak ng tagapag-organisa ang mga susi sa kasalukuyan; walang itinalagang mga custodian sa komunidad {#5-key-custody-is-designed-no-custodians-are-appointed-yet}

**Sa kasalukuyan, ang mga susi ng isang selyadong set ay hawak ng tagapag-organisa nito** — sinuman ang nag-seal nito,
sa kanilang sariling makina. **Walang hawak na mga key share ang Champollion.** Ang *mekanismo* ng
custody para sa higit sa isang may hawak ay naitayo na: hinahati ng M-of-N key ceremony
ng offline node ang isang set key sa mga custodian. Hindi pa ito napapatakbo kasama ang mga totoong
custodian. Ang mga custodian ay pinipili mismo ng mga komunidad, at wala pang naitatalaga:
**mga custodian ng susi sa komunidad — wala pang naitatalaga.** Ang custody ay
hindi pahintulot: ang relasyonal na proseso ng pahintulot ng komunidad ay sarili nitong landas na mas mabagal at
mas mahalaga.

## 6. Sinusukat namin ang mga pamamaraan sa mga benchmark; hindi kami nag-iiskor ng mga indibidwal na salin {#system-vs-output}

Dalawang magkaibang bagay ang tinatawag na "mapagkakatiwalaang machine translation." Ginagawa namin ang isa
sa mga ito.

**Antas ng sistema — ang aming ginagawa.** Kung mayroong pares ng wika, test set, at pamamaraan:
paano umiiskor ang pamamaraang iyon, sa ilalim ng aling metric, sa aling domain, sa aling
contamination lane, sa aling trust tier? Isa itong pahayag tungkol sa isang *pamamaraan sa isang
benchmark*, kasama ang isang pahayag tungkol sa kung sino ang nagtakda ng pamantayan. Ang mga panuntunan sa pag-iskor ay
nailathala, ang mga corpus ay naka-pin, at para sa isang sovereign benchmark, ang komunidad
na nagmamay-ari ng test set ang nagpapasya kung ano ang papasa. Ang leaderboard, ang mapa, ang mga run
card, at ang `mt-eval` ay pawang ganito, at ito lamang.

**Antas ng output — ang hindi namin ginagawa.** Kung bibigyan ng isang pinagmulang pangungusap at isang
salin nito: gaano kalaki ang posibilidad na maging tama ang saling *iyon*? Sa MT at NLP,
iyan ay quality estimation at uncertainty quantification, at isa itong sariling larangan
ng pananaliksik. **Wala kaming inilalathalang per-segment confidence sa anumang salin**,
at walang anuman dito ang isang calibrated probability na tama ang isang partikular na output. Ang isang
hanay na may mataas na iskor ay hindi garantiya sa susunod na pangungusap na gagawin ng isang pamamaraan.

Ang kabaligtaran ang mas madaling pagkakamali, at nakatali rin kami rito. Kapag sinabi ng isang surface dito na
walang pamamaraan sa isang pares ang may sapat na mataas na iskor upang i-deploy — gaya ng ginagawa ng
[mga serbisyo ng pagsasalin ng tao](/human-services) — isa itong pahayag tungkol sa
mga nasukat na pamamaraan sa mga nasukat na test set. Isa itong magandang dahilan upang hindi maglabas ng machine
output para sa pares na iyon. Hindi ito isang hatol sa anumang partikular na pangungusap.

**Ang quality estimation ay isang bukas na puwang, hindi isang nakatagong kakulangan.** Kinakalkula na
ng harness ang isang reference-free neural score, ang AfriCOMET-QE (`qe_score`), bilang
signal ng kasapatan para sa mga run na walang gold reference. Inuulat ito bilang isang
bilang sa **antas ng corpus** sa hiwalay na neural lane, muling hinango ng
verifier, at hindi kailanman pumapasok sa headline ng chrF++
([Ispesipikasyon ng Pag-iskor](/docs/network/specifications/scoring#how-runs-are-scored)). Ang mga metric ay
mga plugin ([Ispesipikasyon ng Plugin](/docs/reference/plugin-spec)), kaya ang isang
segment-level na QE metric ay isang bagay na kayang tanggapin ng harness na ito. Hanggang sa may maikabit,
mailathala, at ma-meta-evaluate bawat wika sa paraang katulad ng mga reference-based metric
([Pagiging Maaasahan ng Metric](/docs/network/specifications/metric-reliability)), wala kaming
sinasabi tungkol sa mga indibidwal na output.

---

Gagalaw ang mga limitasyong ito kasabay ng pag-usad ng gawain. Kapag nagbago ang isa sa mga ito, magbabago rin ang page na ito
kasama nito — at dapat makita ang pagbabago sa page history, hindi
tahimik na alisin.
