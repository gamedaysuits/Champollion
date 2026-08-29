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

> **Buod na Tagapagpaganap.** Ang Champollion po ay mga kagamitan para sa pananaliksik at pagbuo ng machine-translation — source-available at libre para sa hindi komersyal na paggamit, at open source ang evaluation harness nito. Inilalahad po ng pahinang ito ang buong paninindigan nito sa data ng wika: ang mga corpora ay pag-aari ng mga taong pinagmulan nito, ang bawat lisensya at tuntunin ng komunidad ay mekanikal na iginagalang sa halip na sa pamamagitan lamang ng pangako, at ang platform ay hindi nagtatakda ng sarili nitong mga tuntunin sa wika ng sinuman.

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

2. **Iginagalang ang bawat license — sa pamamagitan ng gate, hindi pangako.** Ang non-commercial at
   research-only na corpora ay mekanikal na ibinubukod mula sa anumang paggamit na hindi pinahihintulutan
   ng kanilang license. Ang mga restriction na iginigiit ng isang komunidad lampas sa license ay
   itinatala kasama ang kanilang pinagmulan at iginagalang sa parehong paraan. Nasa
   CI gates at database triggers ang enforcement, hindi sa code of conduct.

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

5. **Kasama ng data ang attribution at credit.** Mandatory ang credit sa builder at linguist
   sa bawat surface kung saan lumilitaw ang isang corpus. Kapag nag-apply ang isang komunidad ng
   [Local Contexts](https://localcontexts.org/) TK o BC Labels, ipinapakita namin
   ang mga ito at iginagalang ang protocol na ini-encode ng mga ito. Dinadala namin ang Labels; hindi namin kailanman
   iniisyu ang mga ito.

6. **Binabayaran ang mga contributor.** Ang pagbuo at validation ng corpus ay propesyonal
   na trabaho sa mga inilathalang rate — tingnan ang
   [Paano Binabayaran ang mga Tagapagsalita](/docs/network/perspectives/how-speakers-get-paid).
   Hindi binibili ng bayad ang corpus: binabayaran ang builder *at* nananatili siyang
   tagapangasiwa.

## Paano nagiging isang pagpapatupad ang isang lisensya

Ang Pangako 2 ay may tiyak na anyo, at nararapat po itong ilahad nang buo — ganito po talaga tumatakbo ang "bawat lisensya ay iginagalang", at hindi lamang ito isang buod ng mabubuting layunin.

**Ang bawat benchmark po ay pumapasok nang naka-hold.** Ang isang bagong nakatalang test set ay naka-quarantine bilang default: nakikita sa index, hindi kasama sa evaluation queue, sa mga paligsahan, at sa bawat ranking. Wala po tayong ipinapalagay tungkol sa isang corpus sa pagpasok nito — kahit na ang isang lisensya na mukhang permissive — hanggang sa masuri ang mga tuntunin nito laban sa aktwal na teksto ng lisensya sa isang naka-pin na upstream revision.

**Ang mga hatol po sa pagsusuri ay mekanikal, at ang mga mahihirap na kaso ay nananatiling naka-hold.** Ang isang malinaw na nakasaad na permissive na lisensya ay nagpapahintulot sa corpus para sa bawat lane. Ang isang malinaw na nakasaad na non-commercial na lisensya ay nagpapahintulot dito papasok sa isang research lane na hindi kasama sa bawat komersyal, premyo, at API surface. At ang isang lisensya na hindi nakasaad, binago, pinaghalo, o bespoke ay **hindi po kailanman binibigyang-kahulugan sa ngalan ng may-ari ng karapatan**: ang corpus ay nananatiling nakatala ngunit naka-hold — wala sa queue, mga paligsahan, at mga ranking — hanggang sa magsaad ng mga tuntunin o magtala ng pagpapahintulot ang may-ari ng karapatan. Ang hatol, ang petsa nito, ang lane nito, at ang batayan nito ay nakatatak nang machine-readable sa corpus card at sa mga registry entry nito, kaya ang "bakit ito runnable?" ay palaging may sagot na maaaring banggitin, at gayundin ang "bakit hindi ito pwede?"

**Ang pagpapadala po ng teksto sa isang modelo ay isang transmission, at ito ay gated.** Ang pagsusuri sa isang modelo ay nangangahulugan ng pagpapadala rito ng mga source sentence — iyon ay ang pag-alis ng corpus sa pinagmulan nito, at pinamamahalaan po ito ayon sa lisensya. Ang mga corpora na may permissive na lisensya ay maaaring gumamit ng mga karaniwang channel. Ang mga corpora sa ilalim ng isang nakasaad na non-commercial na lisensya ay dumadaan lamang sa mga channel na kontraktwal na hindi nagsasanay (train) sa mga input — nakasaad nang eksakto bilang: isang no-training guarantee, hindi isang no-retention guarantee. Ang mga corpora sa ilalim ng hindi nakasaad o binagong mga pagpapahintulot ay tahasang tinatanggihan sa remote evaluation hanggang sa maitala ang pahintulot, at ang mga selyadong community set ay hindi po kailanman umaalis sa imprastraktura ng kanilang steward. Kapag tumanggi ang gate, ang mensahe ng pagtanggi nito ay sumisipi sa hatol ng pagsusuri ng lisensya.

**Ang pagpapatupad po ay nasa ilalim ng bawat client.** Ang mga hold ay ipinapatupad ng isang database trigger na hindi maaaring lampasan ng sinumang client, ang no-hosting rule ay ipinapatupad ng isang repository gate na nag-i-scan sa bawat tracked path para sa nilalaman ng corpus, at ang transmission gate ay tumatakbo sa loob mismo ng evaluation harness. Alinman po sa mga ito ay maaaring humindi sa atin, na siyang pangunahing punto.

## Kung ano ang hindi ito

Ang Champollion ay hindi data broker, hindi translation vendor, at hindi
commercial platform. Ito ay research tooling. Ang mataas na leaderboard score ay nagpapatunay na
gumagana sa teknikal na paraan ang isang method; hindi ito license upang maglathala ng mga pagsasalin,
muling ipamahagi ang corpus, o mag-deploy ng anumang bagay laban sa kagustuhan ng isang komunidad. Ang mga
desisyong iyon ay pag-aari ng tagapangasiwa, palagi.

## Ang mga framework na humubog sa disenyong ito

Hindi dito naimbento ang paninindigang ito. Ito ay hinubog ng, at may utang na loob sa,
Indigenous data governance work sa nakalipas na dalawang dekada:

- **Mga prinsipyo ng data sovereignty ng First Nations** — ipinahayag ng mga
  First Nations sa Canada ang pagmamay-ari, kontrol, pag-access, at pag-aari
  ng komunidad sa sarili nilang impormasyon; ang stewardship model dito ay
  idinisenyong maging compatible sa mga paggigiit na iyon.
- **[CARE Principles](https://www.gida-global.org/care)** (Collective Benefit,
  Authority to Control, Responsibility, Ethics) — Global Indigenous Data
  Alliance.
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — ang Māori Data
  Sovereignty Network.
- **Ang [Kaitiakitanga License](https://tehiku.nz/)** — license ng Te Hiku Media
  para sa data ng te reo Māori na nakabatay sa guardianship, isang direktang impluwensiya sa
  custody model na steward-holds-the-keys na ginagamit dito.

Hinihikayat namin ang sinumang nagdidisenyo ng governance para sa data ng sarili nilang wika na direktang
sumangguni sa mga source na iyon — sila ang may awtoridad, hindi kami. Kapag nag-adopt ang isang komunidad
ng alinman sa mga framework na ito para sa corpus nito, itinatala ng corpus card ang assertion na iyon
at iginagalang ito ng tooling.

Ipinapakita ng Champollion ang Local Contexts **"Open to Collaborate" Notice**: bumubuo kami
ng mga relasyon sa mga komunidad na ang mga wika ay lumilitaw dito, at
ang Labels na isinulat ng komunidad ang nangingibabaw sa anumang sinasabi namin tungkol sa kanilang data.

## Tingnan Din

- [Data Sovereignty, mula sa simula](/docs/learn/data-sovereignty) — ang panimulang bersyon ng pahinang ito, para po sa mga mambabasang bago sa ideyang ito

- [Pagrehistro ng Corpora at Exposure Lanes](/docs/network/sovereignty/registering-corpora) — ang mga mekanismo
- [Para sa mga Komunidad ng Wika](/docs/network/community/for-language-communities) — isang gabay sa payak na wika
- [Paano Binabayaran ang mga Tagapagsalita](/docs/network/perspectives/how-speakers-get-paid) — inilathalang mga rate at tuntunin
- [Mga Paraan ng Pagsasalin](https://champollion.dev/docs/guides/translation-methods) — ang pamamaraang `api`, na nagpapanatili ng prompts, mga diksyunaryo, at coaching data ng isang komunidad sa sarili nitong mga server
