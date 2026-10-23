---
title: "Ang kahulugan ng soberanya ng datos kapag inilapat ito sa software"
sidebar_label: "Soberanya ng datos"
description: "Ang soberanya sa datos ng mga katutubo ay tungkol sa pagmamay-ari at pagkontrol ng komunidad sa datos. Ito ang hitsura ng mga prinsipyong iyon kapag may sumusubok na buuin ang mga ito sa gumaganang software — at kung ano ang hindi maaaring angkinin ng pagtatangkang iyon."
---

# Ano ang kahulugan ng data sovereignty kapag inilapat ito sa software

:::info[Para kanino ito]
Para po sa lahat. Hindi inaasahan ang anumang karanasan sa batas, machine learning, o pamamahalang Katutubo (Indigenous governance).
Kung naitanong niyo na po kung ano ba talaga ang kinakailangan para mapanatili ng isang komunidad
ang kontrol sa sarili nilang data ng wika kapag kasali na ang mga computer, ang pahinang ito
ang mahabang kasagutan.
:::

Karamihan sa mga talakayan ukol sa datos at pahintulot ay humihinto sa pagsang-ayon: may nagsabi ba ng oo.
Ang soberanya ng datos ay nagtatanong ng mas mahirap na tanong: sino ang **nagmamay-ari** nito, at sino ang **nagpapasiya**
kung ano ang mangyayari dito — hindi lamang minsan, kundi habang umiiral ito?

Hindi basta sumulpot ang tanong na iyon. Una at
pinakamapuwersang ipinahayag ang mga ito ng mga Katutubong mamamayan.

---

## 1. Ang mga tanong — at kung sino ang unang nagtanong sa mga ito

Ipinahayag ng First Nations sa Canada ang mga prinsipyo ng soberanya ng datos — pagmamay-ari
at pagkontrol ng komunidad sa sarili nilang impormasyon — bilang paggigiit ng
hurisdiksiyon, na nagmula sa naitalang kasaysayan ng pananaliksik na ginagawa *sa*
mga komunidad sa halip na *kasama* sila, at ng resultang datos na hindi na kailanman
naibabalik.

Ang pinagmulang iyon ay hindi simpleng trivia. Ang mga ito ay hindi pangkalahatang checklist ng etika
na maaaring gamitin ninuman; ang mga ito ay paggigiit ng hurisdiksiyon, na ginawa ng mga partikular
na pamayanan sa mga partikular na legal at pangkulturang kalagayan, at pag-aari ng mga
komunidad na lumikha sa mga ito. Hindi muling inilalahad ng pahinang ito ang mga prinsipyo ng alinmang
balangkas sa ngalan ng mga may-akda nito: basahin po ang mga ito ayon sa pagkasaad ng kanilang mga may-akda.

Sa simpleng pananalita, sama-samang pag-aari ng isang komunidad ang kanilang pangkulturang kaalaman at datos,
kung paanong pag-aari ng isang tao ang kanyang sariling personal na impormasyon, at nagpapasiya sa bawat yugto
ng anumang humahawak dito: kung ano ang kinokolekta, paano, ng sino, para saan, at kung ano ang
gagawin dito pagkatapos.

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

Basahin po itong muli nang isinasaisip ang pagmamay-ari at pagkontrol. Ang pag-upload ay naglilipat
ng pag-iingat: may kopya na ngayon sa makina ng ibang tao. Karaniwan ding inililipat nito
ang praktikal na kontrol — ang inyong kakayahang magsabi ng "ihinto" ay nagiging isang kahilingan, hindi isang
kakayahan. Nananatili ang pagmamay-ari sa papel ngunit nawawalan na ng malaking kabuluhan.

Para sa isang komunidad na ang data ng wika ay nakuha na noon, ang "i-upload ito at magtiwala
sa amin" ay hindi isang neutral na kahilingan. Ito ay may parehong anyo sa bagay na nangyari
na noon.

---

## 3. Ano ba talaga ang mga mekanismo

Ang paninindigan ng proyektong ito ay kung totoo ang sovereignty, dapat itong maging isang katangian
ng software, hindi lamang isang talata sa isang patakaran. Narito po kung ano ang kongkretong anyo
nito. Inilalarawan ang mga ito upang masuri ninyo, at matalakay ninyo ang mga ito.

**Pagpaparehistro nang walang pagsusuko.** Ang isang test set ay nirerehistro sa pamamagitan ng paglalarawan
*kung saan ito nakalagay* at pag-pin ng cryptographic hash ng eksaktong nilalaman nito — hindi sa pamamagitan
ng pag-upload ng mga pangungusap. Sa oras ng pagsusuri, kinukuha ng system ang datos mula sa pinagmulan,
sinusuri kung tumutugma ang hash, at nagbibigay ng marka. Walang iniimbak. Kung gagawing offline ng may-hawak ang
pinagmulan, hindi na lamang masusuri ang corpus. Nananatili ang kontrol kung saan ito
nagsimula, dahil hindi kailanman inilipat ang datos.

**Pag-encrypt bago umalis, para sa pinakamalakas na antas.** Kung saan ang isang corpus ay dapat
magamit nang hindi kailanman nababasa, ito ay ine-encrypt **sa sariling aparato
ng may-hawak**, at ang ciphertext ay nananatili sa may-hawak. Ang natatanggap ng proyektong ito
ay isang paglalarawang walang nilalaman.

**Walang iisang partido ang makakapag-decrypt.** Idinisenyo ang susi upang hatiin sa isang grupo
ng mga tagapangalaga upang ang ilan sa kanila — halimbawa tatlo sa lima — ay kailangang magkasamang
kumilos upang mag-apruba ng anuman. Walang indibidwal na tagapangalaga ang maaaring kumilos nang mag-isa, at
hindi rin magagawa ng proyektong ito: **walang hawak na bahagi ng susi ang Champollion**, kaya hindi ito makakapag-decrypt
mayroon man o walang kooperasyon ng sinuman. Magaganap lamang ang isang run dahil nagpasiya ang isang
korum ng mga tagapangalaga na dapat itong mangyari.

> **Ang tunay na kalagayan nito.** Sa kasalukuyan, ang mga susi ng isang selyadong set ay hawak ng nag-organisa:
> kung sino ang nag-selyo nito, siya ang may hawak sa mga ito. Ang mekanismo ng tagapangalaga ay binuo at nasusubukan,
> ngunit hindi pa ito naisasagawa kasama ang mga totoong tagapangalaga. Mga pampamayanang tagapangalaga ng susi —
> wala pang naitatalaga: ang komposisyon ay pagpapasiya ng mga kasangkot na komunidad, at wala pang
> grupong pumayag na humawak ng mga bahagi. Hangga't wala pa, walang live na hanay ng tagapangalaga,
> at hindi hayagang magpapangalan ng mga kandidato ang proyektong ito. Kaya basahin po ang
> talata sa itaas bilang isang gumaganang mekanismong naghihintay ng mga ugnayang
> magpapagana rito, hindi bilang isang bagay na tumatakbo na ngayon.

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

May mga puwang din sa pagitan ng mga prinsipyo at ng mga mekanismo, at mas gusto
naming pangalanan ang mga ito kaysa hayaan kayong makatuklas sa mga ito. Pag-iingat ang pinakamahusay
na pinagsisilbihan ng mga mekanismong ito — talagang mahusay ang code sa hindi paghawak ng mga bagay. Ang pagmamay-ari at kontrol
ay higit pa sa kayang marating ng software nang mag-isa, tungo sa mga tuntunin, pamamahala, at
mga ugnayan na hindi kayang ayusin ng anumang dami ng cryptography. At bawat
mekanismo sa itaas ay nagpapalagay na ang isang komunidad ay mayroon nang kapasidad at
imprastruktura upang hawakan ang sarili nitong datos, na hindi isang neutral na palagay.

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

Maaaring maghain ng mga pagtutol at pagwawasto sa pamamagitan ng
[paraan ng pakikipag-ugnayan at pagpapatanggal](/docs/your-words-your-rules),
na sumasaklaw rin sa paghiling na alisin ang anuman tungkol sa isang wikang inyong
kinakatawan. Walang obligasyon na maging diplomatiko tungkol dito.

Ang pagiging hindi pa nasusuri (unreviewed) ay isang katotohanan tungkol sa gawaing ito, hindi isang depensa para rito. Ang isang pagtatangka na
nag-iimbita ng pagsusuri ay tapat; ang hindi nag-iimbita ay isang pag-aangkin lamang.

> Ang pahinang ito ay isang paglalarawan ng isang pagtatangkang bumuo patungo sa mga prinsipyong ang mga may-akda ay ang mga komunidad mismo — hanapin ang mga prinsipyong iyon ayon sa pagpapahayag ng kanilang mga may-akda; ang pagtatangkang ito ay hindi ineendorso ng alinman sa mga organisasyong nangangalaga sa kanila.

---

## Saan susunod na pupunta

- [Inyong mga salita, inyong mga panuntunan](/docs/your-words-your-rules) — ang posisyong pagpapatakbo, nang mas malalim.
- [Pagrerehistro ng mga Corpus](/docs/network/sovereignty/registering-corpora) — ang apat na antas ng exposure, at kung ano ang lumalabas sa inyong makina sa ilalim ng bawat isa.
- [Magpatakbo ng isang Soberanong Paligsahan](/docs/network/sovereignty/run-a-sovereign-contest) — ang seremonya ng tagapangalaga, simula hanggang dulo.
- [Tapat na mga Limitasyon](/docs/network/honest-limitations) — kung ano ang hindi inaangkin ng proyektong ito.
- [Inyong mga salita, inyong mga panuntunan](/docs/your-words-your-rules) — ang praktikal na panimulang punto.
