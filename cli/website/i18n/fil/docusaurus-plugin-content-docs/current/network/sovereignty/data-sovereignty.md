---
sidebar_position: 7
title: "Pangangasiwa sa Datos"
description: "Paninindigan ng Champollion tungkol sa datos ng wika: nananatili ang corpora sa kanilang mga tagapangasiwa, iginagalang ang bawat lisensya, at ang mga tuntunin ng komunidad ang namamahala sa datos ng komunidad."
related:
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "The output side: models and derived artifacts belong to speakers"
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The mechanics: benchmark a corpus without handing it over"
  - label: "How the Work Is Funded"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# Pangangasiwa sa Data

> **Pangkalahatang Buod.** Ang Champollion ay kasangkapang pampananaliksik at
> pangkaunlaran para sa machine translation — available ang source code at libre para sa di-komersyal na paggamit, at open source ang
> harness ng ebalwasyon nito. Ipinapahayag nang buo ng pahinang ito ang posisyon nito sa datos ng wika:
> pag-aari ng mga taong pinagmulan ng mga ito ang mga korpus, mekanikal na iginagalang
> ang bawat lisensya at tuntunin ng komunidad sa halip na sa pamamagitan lamang ng pangako, at hindi nagtatakda
> ang plataporma ng sarili nitong mga tuntunin sa wika ng sinuman.

:::info[Ang datos ng wika ay biodata]
Ang datos ng wika ay **biodata**. Tulad ng genetic o health data, taglay ng wika
ang pagkakakilanlan, pagkakamag-anak, at mga ugnayan ng mga taong nagsasalita nito — at tulad ng
genome, hindi ito maaaring i-anonymize sa makabuluhang paraan: alisin man ang mga pangalan, ang wika ay
naka-encode pa rin kung sino ang komunidad nito. Kaya ang mga taong nagbibigay ng corpus ang may hawak ng
mga susi rito, at sa anumang sinusukat batay rito. Iyan ang saligang palagay na pinagbabatayan ng lahat
ng nasa ibaba.
:::

Mula sa batayang iyon, sumusunod ang disenyo. Itinuturing ng Champollion ang bawat contributor ng corpus
bilang **tagapangasiwa**: nananatiling kanila ang corpus — sa legal, pisikal,
at praktikal na paraan — habang ginagawa itong *masusukat* ng imprastruktura.

## Ang mga ipinapangako

1. **Hindi namin kailanman hinahawakan ang data.** Ang corpora ay nirerehistro bilang mga metadata
   card na naka-pin sa hash at kinukuha mula sa sariling hosting ng tagapangasiwa sa oras ng evaluation. Walang anumang
   kinokopya sa repository na ito o inihahatid mula sa aming imprastruktura. Kapag inalis ninyo ang inyong
   archive sa online access, hihinto lang ang evaluation laban dito. Tingnan ang
   [Pagrehistro ng Corpora](/docs/network/sovereignty/registering-corpora).

2. **Iginagalang ang bawat lisensya — sa pamamagitan ng gate, hindi ng pangako.** Mekanikal na
   ibinubukod ang mga korpus na di-komersyal at pampananaliksik lamang mula sa anumang paggamit na
   hindi pinahihintulutan ng kanilang lisensya. Ang mga restriksyong iginigiit ng isang komunidad na higit pa sa lisensya ay
   itinatala kasama ang kanilang pinagmulan at binibigyang-dangal sa parehong paraan. Ang pagpapatupad ay nakapaloob sa
   mga pre-push gate na lokal na pinatatakbo bago ang bawat pag-push (kasalukuyang naka-disable ang CI) at
   sa mga database trigger, hindi sa isang alituntunin ng pag-uugali.

3. **Ang mga tuntunin ay sa tagapangasiwa, at nag-iiba-iba ang mga ito.** Magkakaroon ang iba’t ibang wika ng
   magkakaibang kasunduan — isang pampublikong CC0 corpus, isang research-only na corpus ng komunidad,
   at isang sealed test set na may mga kinakailangan para sa soberanong deployment ay maaari lahat
   lumahok, bawat isa ayon sa sarili nitong mga tuntunin. Walang universal contract dito at
   walang default na pag-angkin sa anumang bagay. Tingnan ang
   [Framework ng Mga Tuntunin](/docs/network/sovereignty/ownership-transfer).

4. **Sinusuportahan ang lihim na corpora bilang arkitektura, hindi eksepsiyon.** Maaaring
   panatilihing sealed ng isang komunidad ang isang test set — nakahawak sa sarili nitong imprastruktura, hindi kailanman nakikita ng
   Champollion o ng mga developer — at magkaroon pa rin ng mga method na masusukat laban dito.
   Ang kakayahang masukat nang hindi maaaring ma-extract ay layunin ng disenyo, hindi workaround.

5. **Kasama ng datos ang pagkilala at kredito.** Sapilitan ang pagkilala
   sa bumuo at lingguwista sa bawat lugar kung saan lumalabas ang isang korpus. Kung saan naglapat ang isang komunidad
   ng mga TK o BC Label ng [Local Contexts](https://localcontexts.org/), nilalayon
   naming ipakita ang mga ito at igalang ang protokol na kanilang isinasaad; hindi pa
   naipapatupad ang suporta para sa Label. Dadalhin namin ang mga Label; hindi kailanman kami lilikha ng mga ito.

6. **Babayaran ang mga nag-aambag.** Ang pagbuo at pagpapatunay ng korpus ay
   propesyonal na gawain, na babayaran sa mga inilathalang rate kapag napondohan na (walang pondong
   hawak sa kasalukuyan) — tingnan ang
   [Paano Binabayaran ang mga Nagsasalita](/docs/network/perspectives/how-speakers-get-paid).
   Hindi binibili ng kabayaran ang korpus: binabayaran ang bumuo *at* nananatili siyang
   tagapangalaga nito.

## Paano nagiging pagpapatupad ang isang lisensya

May tiyak na anyo ang Pangako 2, at nararapat itong ipahayag nang buo — ganito
talaga ipinapatupad ang "iginagalang ang bawat lisensya", hindi lamang buod ng
mabubuting hangarin.

**Pumapasok na nakabinbin ang bawat benchmark.** Naka-quarantine bilang default ang isang bagong katalogo
na test set: nakikita sa index, ngunit ibinukod mula sa evaluation queue, mula
sa mga paligsahan, at mula sa bawat ranggo. Walang ipinapalagay tungkol sa isang korpus sa oras ng pagtanggap
— kahit pa mukhang permissive ang lisensya — hangga't hindi nasusuri ang mga tuntunin nito laban
sa aktwal na teksto ng lisensya sa isang naka-pin na upstream revision.

**Mekanikal ang mga hatol ng pagsusuri, at nananatiling nakabinbin ang mga komplikadong kaso.** Ang isang malinaw
na nakasaad na permissive na lisensya ay nag-aapruba sa korpus para sa bawat lane. Ang isang malinaw na nakasaad
na di-komersyal na lisensya ay nag-aapruba rito patungo sa isang research lane na ibinukod mula
sa bawat komersyal, premyo, at API na surface. At ang isang lisensyang hindi nakasaad,
binago, pinaghalo, o pinasadya ay **hindi kailanman binibigyang-kahulugan sa ngalan ng may-ari ng
karapatan**: nananatiling nakakatalogo ngunit nakabinbin ang korpus — labas sa queue, mga paligsahan,
at mga ranggo — hanggang sa magsaad ng mga tuntunin o magtala ng pagpapahintulot ang may-ari ng karapatan. Ang
hatol, ang petsa nito, ang lane nito, at ang batayan nito ay nakatatak sa paraang machine-readable sa
corpus card at sa mga registry entry nito, upang ang "bakit puwede itong patakbuhin?" ay laging may
masisiping sagot, gayundin ang "bakit hindi ito puwede?"

**Ang pagpapadala ng teksto sa isang modelo ay isang transmisyon, at mayroon itong gate.** Ang pagtatasa sa isang
modelo ay nangangahulugan ng pagpapadala rito ng mga source sentence — iyon ay ang paglisan ng korpus mula sa pinagmulan nito, at
pinamamahalaan ito ayon sa lisensya. Ang mga korpus na may permissive na lisensya ay maaaring gumamit ng mga karaniwang
channel. Ang mga korpus sa ilalim ng nakasaad na di-komersyal na lisensya ay dumadaan lamang sa
mga channel na ayon sa kontrata ay hindi nagsasanay sa mga input — nakasaad nang eksakto bilang: isang
garantiya ng hindi pagsasanay (no-training guarantee), hindi garantiya ng hindi pagpapanatili (no-retention guarantee). Ang mga korpus sa ilalim ng hindi nakasaad o
binagong mga pahintulot ay tahasang tinatanggihan para sa remote na ebalwasyon hangga't hindi naitatala ang
pahintulot, at ang mga nakaselyong set ng komunidad ay hindi kailanman umaalis sa imprastraktura ng
kanilang tagapangalaga. Kapag tumanggi ang gate, sinisipi ng mensahe ng pagtanggi nito ang hatol ng pagsusuri sa lisensya.

**Nasa ilalim ng bawat client ang pagpapatupad.** Ang pagbinbin ay ipinapatupad ng isang
database trigger na hindi maaaring laktawan ng anumang client, ang patakaran sa hindi pag-host ay ipinapatupad ng isang
pre-push gate, na lokal na pinatatakbo bago ang bawat pag-push (kasalukuyang naka-disable ang CI), na
nag-i-scan sa bawat sinusubaybayan at itinutulak na path para sa nilalaman ng korpus, at ang
transmission gate naman ay tumatakbo sa loob mismo ng evaluation harness. Alinman sa mga ito ay maaaring
tumanggi sa atin, at iyon ang mismong punto.

## Kung ano ang hindi ito

Ang Champollion ay hindi data broker, hindi translation vendor, at hindi
commercial platform. Ito ay research tooling. Ang mataas na leaderboard score ay nagpapatunay na
gumagana sa teknikal na paraan ang isang method; hindi ito license upang maglathala ng mga pagsasalin,
muling ipamahagi ang corpus, o mag-deploy ng anumang bagay laban sa kagustuhan ng isang komunidad. Ang mga
desisyong iyon ay pag-aari ng tagapangasiwa, palagi.

## Ang mga framework na humubog sa disenyong ito

Hindi dito naimbento ang paninindigang ito. Ito ay hinubog ng, at may utang na loob sa,
Indigenous data governance work sa nakalipas na dalawang dekada:

- **Mga prinsipyo ng soberanya sa datos ng First Nations** — Ipinahayag ng
  First Nations sa Canada ang pagmamay-ari, kontrol, access, at pag-aari ng komunidad sa
  kanilang sariling impormasyon; idinisenyo ang modelo ng pangangalaga rito upang maging
  katugma ng mga iginiit na iyon.
- **[Mga Prinsipyo ng CARE](https://www.gida-global.org/care)** (Kolektibong Pakinabang,
  Awtoridad sa Pagkontrol, Responsibilidad, Etika) — Global Indigenous Data
  Alliance.
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — ang Māori Data
  Sovereignty Network.
- **Ang [Kaitiakitanga License](https://tehiku.nz/)** — Ang lisensyang nakabatay sa pangangalaga ng Te Hiku Media
  para sa datos ng te reo Māori, isang direktang impluwensya sa modelo ng kustodiya kung saan
  ang tagapangalaga ang may hawak ng mga susi na ginagamit dito.

Hinihikayat namin ang sinumang nagdidisenyo ng governance para sa data ng sarili nilang wika na direktang
sumangguni sa mga source na iyon — sila ang may awtoridad, hindi kami. Kapag nag-adopt ang isang komunidad
ng alinman sa mga framework na ito para sa corpus nito, itinatala ng corpus card ang assertion na iyon
at iginagalang ito ng tooling.

Nilalayon ng Champollion na gamitin ang **Paunawang "Open to Collaborate"** at mga Label
ng Local Contexts; wala pa sa mga ito ang naipapatupad sa kasalukuyan. Kapag naipatupad na ang mga ito, ang mga Label na
isinulat ng komunidad ay mangingibabaw sa anumang sabihin namin tungkol sa datos ng isang komunidad.

## Tingnan Din

- [Soberanya sa Datos, mula sa simula](/docs/learn/data-sovereignty) — ang panimulang bersyon ng pahinang ito, para sa mga mambabasang bago sa ideyang ito

- [Pagrehistro ng Corpora at Exposure Lanes](/docs/network/sovereignty/registering-corpora) — ang mga mekanismo
- [Para sa mga Komunidad ng Wika](/docs/network/community/for-language-communities) — isang gabay sa payak na wika
- [Paano Binabayaran ang mga Tagapagsalita](/docs/network/perspectives/how-speakers-get-paid) — inilathalang mga rate at tuntunin
- [Mga Paraan ng Pagsasalin](https://champollion.dev/docs/guides/translation-methods) — ang pamamaraang `api`, na nagpapanatili ng prompts, mga diksyunaryo, at coaching data ng isang komunidad sa sarili nitong mga server
