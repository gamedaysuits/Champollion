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

Ang mga tanong na iyon ay hindi lumitaw mula sa kawalan. Ang mga ito ay unang ipinahayag at
pinakamakapangyarihang iginiit ng mga Katutubong mamamayan.

---

## 1. Ang mga tanong — at kung sino ang unang nagtanong sa mga ito

Ipinahayag ng First Nations sa Canada ang mga prinsipyo ng soberanya sa datos ng
**pagmamay-ari, pagkontrol, pag-access, at paghawak** bilang paggigiit ng hurisdiksiyon
sa kanilang sariling impormasyon — nagmumula sa isang dokumentadong kasaysayan ng pananaliksik
na isinagawa *sa* mga komunidad sa halip na *kasama* sila, at ng resultang datos
na hindi na kailanman naibalik.

Ang pinagmulang iyon ay hindi simpleng trivia. Ang mga ito ay hindi pangkalahatang checklist ng etika
na maaaring kunin ninuman; ang mga ito ay mga paggigiit ng hurisdiksiyon, na ginawa ng mga partikular
na mamamayan sa mga partikular na legal at kultural na konteksto, at pag-aari ng mga
komunidad na lumikha sa kanila.

Ang apat na tanong, sa madaling sabi:

| | Ang katanungang sinasagot nito |
|---|---|
| **Ownership** | Sino ang nagmamay-ari ng impormasyong ito? Sama-samang pagmamay-ari ng isang komunidad ang kanilang kultural na kaalaman at data — katulad ng pagmamay-ari ng isang tao sa kanilang sariling personal na impormasyon. |
| **Control** | Sino ang nagpapasya kung ano ang mangyayari dito? Kinokontrol ng mga komunidad ang bawat yugto ng anumang may kinalaman sa kanila: kung ano ang kinokolekta, paano, nino, para saan, at kung ano ang gagawin dito pagkatapos. |
| **Access** | Sino ang maaaring maka-access nito? Dapat ay may kakayahan ang mga komunidad na ma-access ang impormasyon tungkol sa kanilang sarili, saanman ito nakalagay, sinuman ang may hawak nito. |
| **Possession** | Saan ito pisikal na nakalagay? Hindi ito katulad ng pagmamay-ari (ownership) — ang possession ay ang kongkretong katotohanan ng pangangalaga (custody), at ito ang mekanismo na nagpapatupad sa tatlong iba pa sa halip na ipangako lamang. |

May umiiral na magkakaibang balangkas at hindi maaaring pagpalitin ang mga ito sa isa't isa:
ang **CARE** (Collective Benefit, Authority to Control, Responsibility, Ethics)
para sa pamamahala ng Katutubong datos sa pangkalahatan, at ang **Te Mana Raraunga** para sa
soberanya sa datos ng Māori, bukod sa iba pa. Ang bawat isa ay lumitaw sa sarili nitong legal at kultural
na kalagayan. Ang paggamit ng pangalan ng isang balangkas para sa mga prinsipyo ng iba ay sarili nitong anyo
ng pagbura.

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

**Pag-encrypt bago umalis, para sa pinakamalakas na antas.** Kung saan ang isang corpus ay dapat
magamit nang hindi kailanman nababasa, ito ay ine-encrypt **sa sariling aparato
ng may-hawak**, at ang ciphertext ay nananatili sa may-hawak. Ang natatanggap ng proyektong ito
ay isang paglalarawang walang nilalaman.

**Walang iisang partido ang maaaring mag-decrypt.** Idinisenyo ang susi upang hatiin sa isang pangkat
ng mga tagapangalaga upang ang ilan sa kanila — halimbawa'y tatlo sa lima — ay kailangang kumilos
nang magkakasama upang magpahintulot ng anuman. Walang indibidwal na tagapangalaga ang maaaring kumilos nang mag-isa, at
gayundin ang proyektong ito: nagbibigay ang disenyo ng **zero shares sa Champollion**, kaya hindi ito
makakapag-decrypt may kooperasyon man o wala ng sinuman. Magaganap lamang ang pagpapatakbo dahil nagpasya ang isang korum ng mga tagapangalaga na dapat itong mangyari.

> **Kung saan ito tunay na nakatayo.** Ang mekanismo ay binuo at nasusubukan, ngunit hindi pa
> ito napapatakbo kasama ang mga totoong tagapangalaga. *Walang mga tagapangalagang
> itinalaga* — ang komposisyon ay pag-aari ng mga sangkot na komunidad, at wala pang grupong
> pumayag na humawak ng mga share sa ngayon. Hanggang sa gawin nila ito,
> walang live na hanay ng tagapangalaga, at hindi magpapangalan ang proyektong ito ng mga kandidato
> sa publiko. Kaya basahin ang talata sa itaas bilang isang gumaganang mekanismong naghihintay sa mga
> relasyong magpapagana rito, hindi bilang isang bagay na tumatakbo na ngayon.

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

**Ang proyektong ito ay hindi napatunayan, sertipikado, o inaprubahan laban sa alinmang balangkas
ng soberanya sa datos ng Katutubo. Walang pagtatasa na naganap, walang nakabinbin,
at wala ring ipinapahiwatig.**

Ang umiiral ay isang **pagtatangkang isabuhay ang soberanya sa datos sa code** — ang kunin
ang mga prinsipyong ipinahayag ng mga Katutubong mamamayan at ipahayag ang mga ito bilang mga gumaganang
mekanismo sa halip na mga pangako lamang. Ang pagtatangkang iyon ay amin. Kung ito man ay magtagumpay
ay hindi para sa amin na ipahayag. Ang mga pagpapasiya sa pagsunod ay pag-aari ng mga komunidad
na sangkot, at ang isang proyektong naggigiit ng sarili nitong pagsunod ay muling gagawa nang
paliit ng eksaktong gawi na nilalayon ng mga prinsipyong itong ituwid: ang estrangherong
nagpapasiya kung ano ang itinuturing na sapat na pagtrato sa impormasyon ng isang komunidad.

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

Kung nagtatrabaho kayo sa pamamahala ng Katutubong datos, CARE, Te Mana Raraunga, o
teknolohiya ng Katutubong wika — o kung kayo ay miyembro o kinatawan ng isang
komunidad na ang wika ay nasa index na ito — nais naming marinig kung saan ito nagkakamali.
Sa partikular:

- kung saan ang isang mekanismo ay hindi gumagawa ng hinihingi ng prinsipyo;
- kung saan ang pagkakabalangkas ay maling naglalarawan sa mga prinsipyo ng komunidad, o humihiram sa kanilang awtoridad;
- kung saan ang isang bagay ay inilarawan bilang pamprotekta na hindi naman magpoprotekta sa inyo;
- kung saan ang isang komunidad ay mangangailangan ng isang bagay na hindi pa namin nabubuo;
- kung saan ang mismong bokabularyo ay hindi angkop.

Ang mga pagtutol at pagwawasto ay maaaring iparating sa pamamagitan ng
[ruta ng pakikipag-ugnayan at pag-takedown](/docs/network/community/contact-objections-takedown),
na sumasaklaw rin sa paghiling na alisin ang anuman tungkol sa isang wika na inyong
kinakatawan. Hindi po kinakailangang maging diplomatiko tungkol dito.

Ang pagiging hindi pa nasusuri (unreviewed) ay isang katotohanan tungkol sa gawaing ito, hindi isang depensa para rito. Ang isang pagtatangka na
nag-iimbita ng pagsusuri ay tapat; ang hindi nag-iimbita ay isang pag-aangkin lamang.

> Ang pahinang ito ay isang paglalarawan ng isang pagtatangkang bumuo patungo sa mga prinsipyong ang mga may-akda ay ang mga komunidad mismo — hanapin ang mga prinsipyong iyon ayon sa pagpapahayag ng kanilang mga may-akda; ang pagtatangkang ito ay hindi ineendorso ng alinman sa mga organisasyong nangangalaga sa kanila.

---

## Saan susunod na pupunta

- [Data Stewardship](/docs/network/sovereignty/data-sovereignty) — ang posisyon sa pagpapatakbo, nang mas malalim.
- [Registering Corpora](/docs/network/sovereignty/registering-corpora) — ang apat na exposure tier, at kung ano ang umaalis sa inyong machine sa ilalim ng bawat isa.
- [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) — ang seremonya ng custodian, mula simula hanggang dulo.
- [Honest Limitations](/docs/network/honest-limitations) — kung ano ang hindi inaangkin ng proyektong ito.
- [For Language Communities](/docs/network/community/for-language-communities) — ang praktikal na panimulang punto.
