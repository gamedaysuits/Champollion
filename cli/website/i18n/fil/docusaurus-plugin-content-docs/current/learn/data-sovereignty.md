---
title: "Ang kahulugan ng soberanya ng datos kapag inilapat ito sa software"
sidebar_label: "Soberanya ng datos"
description: "Ang soberanya ng datos ng mga Katutubo ay isang hanay ng mga prinsipyo tungkol sa kung sino ang nagmamay-ari, kumokontrol, nakaka-access, at nagtataglay ng datos. Ganito po ang nagiging anyo ng mga prinsipyong iyon kapag sinubukan itong buuin sa isang gumaganang software — at kung ano ang hindi maaaring angkinin ng pagtatangkang iyon."
---

# Ano ang kahulugan ng data sovereignty kapag inilapat ito sa software

:::info[Para kanino ito]
Para po sa lahat. Hindi inaasahan ang anumang karanasan sa batas, machine learning, o pamamahalang Katutubo (Indigenous governance).
Kung naitanong niyo na po kung ano ba talaga ang kinakailangan para mapanatili ng isang komunidad
ang kontrol sa sarili nilang data ng wika kapag kasali na ang mga computer, ang pahinang ito
ang mahabang kasagutan.
:::

Karamihan sa mga talakayan tungkol sa data at pahintulot (consent) ay nagtatapos sa pagpayag: mayroon bang sumang-ayon.
Ang data sovereignty ay nagtatanong ng mas mahihirap na katanungan. Sino ang **nagmamay-ari** nito? Sino ang nagpapasya
kung ano ang mangyayari dito? Sino ang maaaring maka-access nito? Saan ito pisikal na nakalagay?

Ang mga katanungang iyon ay hindi basta lumitaw mula sa wala. Una at pinakamariing
ipinahayag ang mga ito ng mga Katutubong mamamayan (Indigenous peoples).

---

## 1. Ang mga katanungan — at kung sino ang unang nagtanong ng mga ito

Ipinahayag ng mga First Nations sa Canada ang mga prinsipyo ng data sovereignty na
**pagmamay-ari, pagkontrol, pag-access, at pag-aari (ownership, control, access, and possession)**
bilang isang paggigiit ng hurisdiksyon sa sarili nilang impormasyon — na nagmumula sa isang
naitalang kasaysayan ng pananaliksik na ginawa *sa* mga komunidad sa halip na *kasama* nila,
at ng nagresultang data na hindi na kailanman naibalik.

Ang pinagmulang iyon ay hindi lamang isang trivia. Ang mga ito ay hindi isang pangkalahatang
checklist ng etika na maaaring gamitin ng sinuman; ang mga ito ay mga paggigiit ng hurisdiksyon,
na ginawa ng mga partikular na mamamayan sa mga partikular na legal at kultural na kapaligiran,
at nabibilang ang mga ito sa mga komunidad na gumawa ng mga ito.

Ang apat na katanungan, sa maikling salita:

| | Ang katanungang sinasagot nito |
|---|---|
| **Ownership** | Sino ang nagmamay-ari ng impormasyong ito? Sama-samang pagmamay-ari ng isang komunidad ang kanilang kultural na kaalaman at data — katulad ng pagmamay-ari ng isang tao sa kanilang sariling personal na impormasyon. |
| **Control** | Sino ang nagpapasya kung ano ang mangyayari dito? Kinokontrol ng mga komunidad ang bawat yugto ng anumang may kinalaman sa kanila: kung ano ang kinokolekta, paano, nino, para saan, at kung ano ang gagawin dito pagkatapos. |
| **Access** | Sino ang maaaring maka-access nito? Dapat ay may kakayahan ang mga komunidad na ma-access ang impormasyon tungkol sa kanilang sarili, saanman ito nakalagay, sinuman ang may hawak nito. |
| **Possession** | Saan ito pisikal na nakalagay? Hindi ito katulad ng pagmamay-ari (ownership) — ang possession ay ang kongkretong katotohanan ng pangangalaga (custody), at ito ang mekanismo na nagpapatupad sa tatlong iba pa sa halip na ipangako lamang. |

May mga natatanging framework na umiiral at hindi maaaring ipagpalit ang mga ito sa isa't
isa: **CARE** (Collective Benefit, Authority to Control, Responsibility,
Ethics) para sa pangkalahatang pamamahala ng data ng mga Katutubo, at **Te Mana Raraunga** para sa
data sovereignty ng mga Māori. Ang bawat isa ay umusbong sa sarili nitong legal at kultural na kapaligiran. Ang paggamit
ng pangalan ng isang framework para sa mga prinsipyo ng iba ay isang uri ng pagbubura (erasure).

---

## 2. Bakit pinatitingkad ito ng software

Ang isang prinsipyo ay maaaring manatili sa papel bilang isang mabuting intensyon. Pinipilit ng software ang
katanungan, dahil ang isang computer ay hindi kumikilos batay sa mga intensyon — kumikilos ito batay sa kung ano ang
binuo.

Isaalang-alang po natin ang karaniwang paraan kung paano sinusuri ang isang translation system. Upang malaman
kung mahusay na naisasalin ng isang system ang inyong wika, kailangan ng isang **test set**:
mga pangungusap sa inyong wika, na ipinares sa kung ano ang ibig sabihin ng mga ito. Halos bawat evaluation
platform ay humihiling sa inyo na i-**upload** ang test set na iyon upang magamit ito sa pagmamarka.

Basahin po itong muli habang isinasaalang-alang ang apat na katanungan. Ang pag-upload ay naglilipat ng
possession. Karaniwan nitong inililipat ang praktikal na kontrol — kapag mayroon nang kopya sa
machine ng ibang tao, ang inyong kakayahang sabihing "ihinto" ay nagiging isang kahilingan na lamang, at hindi isang
kakayahan. Ang access ay nagiging isang bagay na ipinagkakaloob sa inyo sa halip na isang bagay na
taglay ninyo. Ang ownership ay nananatili na lamang sa papel at nawawalan ng tunay na halaga.

Para sa isang komunidad na ang data ng wika ay nakuha na noon, ang "i-upload ito at magtiwala
sa amin" ay hindi isang neutral na kahilingan. Ito ay may parehong anyo sa bagay na nangyari
na noon.

---

## 3. Ano ba talaga ang mga mekanismo

Ang paninindigan ng proyektong ito ay kung totoo ang sovereignty, dapat itong maging isang katangian
ng software, hindi lamang isang talata sa isang patakaran. Narito po kung ano ang kongkretong anyo
nito. Inilalarawan ang mga ito upang masuri ninyo, at matalakay ninyo ang mga ito.

**Pagpaparehistro nang walang pagsuko (Registration without surrender).** Ang isang test set ay inirerehistro sa pamamagitan ng paglalarawan
*kung saan ito nakalagay* at pag-pin ng isang cryptographic hash ng eksaktong nilalaman nito — hindi sa pamamagitan ng
pag-upload ng mga pangungusap. Sa oras ng pagsusuri (evaluation), kinukuha ng system ang data mula sa source,
sinusuri kung tumutugma ang hash, at nagmamarka. Walang anumang iniimbak. Kung i-offline ng may hawak ang
source, ang corpus ay hindi na maaaring masuri. Ang kontrol ay nananatili kung saan ito
nagsimula, dahil hindi kailanman nailipat ang possession.

**Encryption bago ang pag-alis, para sa pinakamatibay na tier.** Kung saan ang isang corpus ay dapat maging
magagamit nang hindi kailanman nababasa, ito ay ine-encrypt **sa mismong device ng may hawak**
bago pa man may umalis na data. Ang natatanggap ng proyektong ito ay ciphertext at isang
paglalarawan na walang nilalaman.

**Walang iisang partido ang maaaring mag-decrypt.** Ang key ay hinahati sa isang grupo ng mga custodian upang
ang ilang bilang sa kanila — halimbawa ay tatlo sa lima — ay dapat kumilos nang sama-sama upang pahintulutan
ang anuman. Walang indibidwal na custodian ang maaaring kumilos nang mag-isa, at hindi rin maaari ang proyektong ito:
ang napagpasyahang modelo ay **walang hawak na shares ang Champollion**, kaya hindi ito maaaring
mag-decrypt nang mayroon man o walang kooperasyon ng sinuman. Ang isang run ay nangyayari dahil napagpasyahan ng isang quorum ng
mga custodian na dapat itong mangyari.

> **Kung ano ang kasalukuyang katayuan nito.** Ang mekanismo ay binuo na at maaaring masubukan. Ang
> *mga custodian ay hindi pa kumpirmado* — ang komposisyon ay nabibilang sa mga komunidad
> na kasangkot, at wala pang grupo ang sumang-ayon na humawak ng mga share. Hangga't wala pa sila,
> walang live na set ng custodian, at hindi isasapubliko ng proyektong ito ang mga pangalan ng mga kandidato.
> Kaya basahin po ang talata sa itaas bilang isang gumaganang mekanismo na naghihintay sa
> mga ugnayan na magpapatakbo rito, hindi bilang isang bagay na tumatakbo na sa kasalukuyan.

**Mga resulta nang walang pagkakalantad (Results without exposure).** Ang bumabalik mula sa isang selyadong pagsusuri ay
mga marka, hindi mga pangungusap. Ang isang pamamaraan ay maaaring mapatunayang gumagana sa isang corpus na hindi
kailanman nabasa ng may-akda ng pamamaraan, at ng proyektong ito.

**Pahintulot bago ang pagpapadala (Consent before transmission).** Ang pagpapadala ng text sa isang external model API ay isa na ring
pagsisiwalat (disclosure). Ang mga corpora sa ilalim ng komunidad, pasadya (bespoke), o hindi nakasaad na mga lisensya ay **tumatanggi**
sa remote evaluation hanggang sa malinaw na maitala ng may hawak ng karapatan ang pahintulot para
dito. Ang pagtangging iyon ay ipinapatupad sa code, at walang automated na proseso ang maaaring magbigay ng
pahintulot sa ngalan ng isang komunidad.

**Reversibility sa isang direksyon lamang.** Ang pagkakalantad (exposure) ay maaaring luwagan sa pamamagitan ng isang
sadyang desisyon ng may hawak. Hindi kailanman ito lumuluwag nang by default, nang hindi sinasadya, o
para sa kaginhawaan ng ibang tao.

---

## 4. Kung ano ang hindi kinakatawan nito

**Ang proyektong ito ay hindi na-validate, na-certify, o naaprubahan laban sa anumang
framework ng data sovereignty ng mga Katutubo. Walang pagsusuri
na naganap, walang nakabinbin, at walang ipinapahiwatig.**

Ang umiiral ay isang **pagtatangka na isabatas ang data sovereignty sa code** — na kunin ang mga prinsipyong
ipinahayag ng mga Katutubong mamamayan at ipahayag ang mga ito bilang mga gumaganang mekanismo sa halip na
mga pangako. Ang pagtatangkang iyon ay sa amin. Kung magtatagumpay ito ay hindi sa amin upang ideklara.
Ang mga pagtukoy sa pagsunod (compliance) ay nabibilang sa mga komunidad na kasangkot, at ang isang proyekto na naggigiit ng sarili
nitong pagsunod ay muling lilikha sa maliit na sukat ng eksaktong pustura na nais iwasto ng mga prinsipyong ito:
ang tagalabas na nagpapasya kung ano ang itinuturing na sapat na pagtrato sa
impormasyon ng isang komunidad.

Hindi rin alinman dito ay isang garantiya ng imposibilidad. Ang software ay may mga depekto. Ang mga operator
ay nagkakamali. Ang isang determinadong partido na may hawak ng sapat na mga tamang tungkulin ay isang
natitirang panganib (residual risk) na hindi naaalis ng anumang arkitektura. Ang pahayag ay mas tiyak at, sa aming palagay,
mas kapaki-pakinabang: **ang mga madaling landas ay sarado na, at ang mga mahihirap ay nag-iiwan ng ebidensya.**

Mayroon ding mga puwang sa pagitan ng mga prinsipyo at ng mga mekanismo, at mas nanaisin
namin na pangalanan ang mga ito kaysa hayaan kayong hanapin ang mga ito. Ang Possession ang prinsipyo na pinakamahusay na
pinaglilingkuran ng mga mekanismong ito — ang code ay tunay na mahusay sa hindi paghawak ng mga bagay.
Ang Ownership at Control ay umaabot nang higit pa sa kayang gawin ng software nang mag-isa, patungo sa mga tuntunin,
pamamahala, at mga ugnayan na hindi naaayos ng anumang dami ng cryptography. At ang bawat
mekanismo sa itaas ay ipinapalagay na ang isang komunidad ay mayroon nang kapasidad at
imprastraktura upang hawakan ang sarili nitong data, na hindi isang neutral na pagpapalagay.

---

## 5. Mangyaring makipagtalakayan tungkol dito

Ang pagtatangka ay bukas sa pagpuna, at ang imbitasyon ay hindi lamang isang palamuti.

Kung nagtatrabaho po kayo sa pamamahala ng data ng mga Katutubo (Indigenous data governance), CARE, Te Mana Raraunga, o
teknolohiya ng wika ng mga Katutubo — o kung kayo ay miyembro o kinatawan ng isang
komunidad na ang wika ay nasa index na ito — nais po naming marinig kung saan ito nagkakamali.
Partikular na sa:

- kung saan ang isang mekanismo ay hindi ginagawa ang hinihingi ng prinsipyo;
- kung saan ang pagkakabalangkas ay nagbibigay ng maling representasyon sa mga prinsipyo ng isang komunidad, o humihiram sa awtoridad ng mga ito;
- kung saan ang isang bagay ay inilalarawan bilang proteksiyon ngunit hindi naman kayo mapoprotektahan;
- kung saan ang isang komunidad ay mangangailangan ng isang bagay na hindi pa namin nabubuo;
- kung saan ang mismong bokabularyo ay hindi angkop.

Ang mga pagtutol at pagwawasto ay maaaring iparating sa pamamagitan ng
[ruta ng pakikipag-ugnayan at pag-takedown](/docs/network/community/contact-objections-takedown),
na sumasaklaw rin sa paghiling na alisin ang anuman tungkol sa isang wika na inyong
kinakatawan. Hindi po kinakailangang maging diplomatiko tungkol dito.

Ang pagiging hindi pa nasusuri (unreviewed) ay isang katotohanan tungkol sa gawaing ito, hindi isang depensa para rito. Ang isang pagtatangka na
nag-iimbita ng pagsusuri ay tapat; ang hindi nag-iimbita ay isang pag-aangkin lamang.

> Ang pahinang ito ay isang paglalarawan ng isang pagtatangka na bumuo patungo sa mga prinsipyong ang mga may-akda ay ang mga komunidad mismo — hanapin po ang mga prinsipyong iyon ayon sa pagpapahayag ng kanilang mga may-akda; ang pagtatangkang ito ay hindi inendorso ng alinman sa mga organisasyong nangangasiwa sa mga ito.

---

## Saan susunod na pupunta

- [Data Stewardship](/docs/network/sovereignty/data-sovereignty) — ang posisyon sa pagpapatakbo, nang mas malalim.
- [Registering Corpora](/docs/network/sovereignty/registering-corpora) — ang apat na exposure tier, at kung ano ang umaalis sa inyong machine sa ilalim ng bawat isa.
- [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) — ang seremonya ng custodian, mula simula hanggang dulo.
- [Honest Limitations](/docs/network/honest-limitations) — kung ano ang hindi inaangkin ng proyektong ito.
- [For Language Communities](/docs/network/community/for-language-communities) — ang praktikal na panimulang punto.
