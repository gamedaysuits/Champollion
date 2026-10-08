---
title: "Matapat na mga Limitasyon"
description: "Ang hindi (pa) inaangkin ng Champollion. Ang mga nasusuring limitasyon sa aming evaluation, trust tiers, community validation, at held-out infrastructure."
---

# Matapat na mga Limitasyon

> Ito ang mga pahayag na **hindi** namin lalampasan. Kung may anumang nasa ibang bahagi ng
> site na ito na nagpapahiwatig ng higit pa kaysa sa nakasulat dito, ituring po ninyo iyon bilang bug at
> [ipaalam sa amin](/docs/network/perspectives/reporting-errors-and-owning-corrections).

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

## 2. Self-reported ang trust tiers sa launch

Karamihan sa mga score ay kinukuwenta ng mga contributor na sila mismo ang nagpapatakbo ng harness at
nagpa-publish ng resulta. Umiiral at lumalawak ang server-side **verification** — muling pag-score ng isang submission
laban sa SHA-pinned canonical corpus — ngunit
hindi pa pangkalahatan ang "verified". Basahin po ang trust badge sa bawat row: **ang "self-reported"
ay nangangahulugan mismo niyan**, at iyon ang default.

## 3. Hindi pa nangyayari ang community speaker-validation

Ang aming premyo ay nangangailangan ng **≥ 70% na pagtanggap mula sa mga bilingguwal na tagapagsalita**. Ang gate na iyon ay
tinukoy, at ang mga kagamitan upang patakbuhin ito ay kasalukuyang itinatayo — ngunit **walang pagsusuri ng mga tagapagsalita ng komunidad ang naisagawa**, at **walang iskor sa site na ito ang nakapasa sa
speaker gate**. Ang chrF++ at bawat iba pang awtomatikong numero ay mga machine signal,
hindi isang hatol ng komunidad, kung kaya't walang iskor dito ang nagdadala ng label ng kalidad.

## 4. Umiiral ang evaluation sandbox at key ceremony; wala pang tagapangalagang gumamit sa mga ito

Kinukuha namin ang mga corpus mula sa kanilang pinagmulan at ini-SHA-pin ang mga ito, at ang mga held-out split ay
naka-seal. Kapag ang isang komunidad ay nagtataglay ng isang lihim na test set, maaaring mai-score ang isang pamamaraan
laban dito nang hindi kailanman umaalis ang set sa kanilang mga kamay — at ang ebalwasyong iyon
ay mayroon na ngayong **dalawang lane**. Ang
mas pinapaboran, para sa mga karaniwang neural model, ay **declarative**: data lamang ang isinusumite
ng kalahok — mga safetensors weight + isang declarative tokenizer + isang config —
at pinapatakbo ito ng tagapag-organisa sa sarili nilang pinagkakatiwalaang inference engine
(`trust_remote_code=False`, offline; permisibo tungkol sa arkitektura dahil
ang kaligtasan ay nasa format na walang code, hindi sa pangalan ng arkitektura). Walang code ng kalahok ang tumatakbo
kahit kailan, kaya walang kailangang i-sandbox; ang pagsusuri sa kaligtasan ay isang mapagpapasyahang balidasyon
ng format (safetensors ba ito at hindi pickle? walang `trust_remote_code`?), hindi
isang pagtatangkang patunayan na ligtas ang di-tiyak na code. Para sa mga pamamaraang tunay na code
(mga pipeline, mga LLM-coached hybrid), ang fallback ay ang network-isolated na
**sandbox** (mga static check, mga container ng `--network=none`, scores-only na egress, isang
opsyonal na true-airgap file transport). Dahil walang network ang sandbox, tumatakbo lamang
doon ang isang pamamaraan kasama ang bawat modelong tinatawag nito sa loob ng bundle nito: dapat
ipadala ng isang LLM-coached hybrid ang LLM nito bilang mga open weight, dahil ang isang naka-host na LLM API
ay hindi maabot. Nilalaman ng sandbox ang di-pinagkakatiwalaang code sa halip
na tanggihang patakbuhin ito, kaya ito ang tapat na mas mahinang lane — ang pangunahing sumusuportang
garantiya nito ay `--network=none` (hindi masusuri ng isang heuristic static scan ang isang binary
model), at ang mas malalim na hardening (seccomp, mga microVM) ay ipinagpaliban. Tingnan ang
[magpatakbo ng sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest)
para sa eksaktong kung ano ang aktibo at kung ano ang hindi. Ang **key ceremony** ng offline node ay
**naitayo na** — ang set key ay hinahati nang M-of-N at muling binubuo sa memorya lamang sa panahon ng isang
run na pinahintulutan ng quorum — ngunit hindi pa ito kailanman nagamit kasama ng isang totoong tagapangalaga, at
ang mga share ay mga payak na file sa unang bersyong ito. Ang **hindi** naitayo: threshold
signing (ang isang iskor ay nilalagdaan ng isang solong node key) at hardware attestation (ang mga score
manifest ay nilalagdaan sa software lamang). Wala pang tagapangalagang naitalaga, kaya ang
gold-standard na ebalwasyon ng **premyo** ay nananatiling sarado hanggang sa maipatupad ang mga tagapangalaga at
ang pahintulot ng komunidad.

## 5. Dinisenyo na ang pag-iingat ng susi; wala pang mga tagapangalagang naitalaga

Ang *mekanismo* ng pag-iingat ay dinisenyo: isang threshold scheme kung saan **dinisenyo ang Champollion
na humawak ng zero key share**. Hindi pa ito napapatakbo kasama ang mga totoong
tagapangalaga. Ang mga tagapangalaga ay pinipili mismo ng mga komunidad, at wala pang
naitalaga, kaya sinasabi naming **"mga tagapangalaga ng susi ng komunidad — wala pang naitalaga."**
Ang pag-iingat ay hindi pahintulot: ang proseso ng relasyonal na pahintulot ng komunidad ay sarili nitong
mas mabagal, at mas mahalagang landas.

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
