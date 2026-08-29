---
title: "Kung paano nagpapasya ang isang tokenizer kung aling mga wika ang mura"
sidebar_label: "Mga Tokenizer"
description: "Bago po basahin ng isang language model ang isang salita, may humahati rito sa mga piraso. Ang hakbang na ito ay natututunan mula sa data, nag-o-optimize ng compression sa halip na kahulugan, at tahimik na nagpapasya kung aling mga wika ang mahal gamitin. Ito po ay isang panimulang gabay para sa mga mambabasang walang paunang kaalaman."
---

# Kung paano nagpapasya ang isang tokenizer kung aling mga wika ang mura

:::info[Para kanino ito]
Para sa sinuman. Ipinapalagay ng pahinang ito na wala kang background sa machine-learning at wala ring background
sa linggwistika. Kung alam mo kung ano ang isang language model — software na kumukuha ng teksto at
gumagawa ng teksto — sapat na iyon.
:::

Ang bawat language model ay may hindi nakikitang unang hakbang. Bago ito magbasa ng isang salita, isang
piraso ng software ang pumuputol sa salitang iyon sa mga bahagi (fragments). Ang mga bahaging ito ang aktwal na nakikita
ng model.

Ang hakbang na iyon ay tinatawag na **tokenization**, at halos walang pumapansin dito. Mahalaga itong
tingnan, dahil ito ang punto kung saan ang ilang mga wika ay nagiging mas
mahal gamitin nang ilang beses kaysa sa iba — at ang desisyon ay ginagawa bago pa man may
mag-isip tungkol sa kalidad, pagiging patas, o saklaw.

---

## 1. Hindi marunong magbasa ang isang model

Ang isang neural network ay gumagawa ng aritmetika sa mga numero. Wala itong konsepto ng mga titik o
mga salita. Kaya ang teksto ay kailangang maging mga numero muna.

Ang isang **tokenizer** ay ang piraso ng software na gumagawa ng conversion na iyon, at binabaligtad
ito sa dulo. Ginagawa nitong isang listahan ng mga integer ang isang string, kung saan ang bawat integer ay tumuturo
sa isang row sa isang malaking lookup table.

Gumagawa ito ng dalawang desisyon:

**Ang bokabularyo (vocabulary)** — ang nakapirming imbentaryo ng mga piraso na pinapayagang makita ng model.
Hindi mga salita: *mga piraso*. Ang mga karaniwan ay mga buong salita, ngunit ang mga mas bihirang materyal ay pinaghihiwa-hiwalay.
Ang imbentaryo ay may nakapirming laki, na pinili nang maaga — kadalasang sampu-sampung
libong mga entry.

**Ang segmentasyon (segmentation)** — para sa anumang aktwal na string, kung aling mga piraso, at sa anong pagkakasunud-sunod. Ang
salitang *unbelievable* ay maaaring maging `un` + `believ` + `able`, o isang buong piraso, o
labing-isang indibidwal na titik. Kung alin ang makukuha mo ay nakadepende nang buo sa kung ano ang nasa
bokabularyo.

> **Halimbawa.** Kung ang `believ` ay nasa bokabularyo, ang *unbelievable* ay nagkakahalaga ng
> tatlong piraso. Kung wala ito, ang tokenizer ay babalik sa mas maliliit na
> bahagi hanggang sa masakop nito ang salita — posibleng isang piraso bawat titik. Parehong
> salita, parehong kahulugan, tatlong beses ang dami ng piraso o labing-isang beses ang dami ng piraso,
> depende sa isang desisyong ginawa bago mo pa man ito i-type.

---

## 2. Ang bokabularyo ay *natututunan*, at ino-optimize nito ang maling bagay

Narito ang bahaging nakakagulat sa mga tao.

Ang bokabularyo ay hindi idinisenyo ng isang linggwista. Ito ay **natututunan mula sa isang tumpok ng
teksto**, ng isang algorithm na ang layunin ay **kompresyon (compression)** — saklawin ang tekstong ito sa pinakakaunting
piraso hangga't maaari.

Walang papel ang kahulugan. Walang ideya ang algorithm kung ano ang isang salita, kung ano ang isang unlapi (prefix),
o na may umiiral na wika. Binibilang nito kung ano ang madalas na magkakasama, at binibigyan
ang mga madalas na sequence ng sarili nilang entry dahil ginagawa nitong mas maikli ang teksto.

Ang kahihinatnan ay sumusunod nang mekanikal. Ang mga piraso ay inilalaan sa isang wika nang halos
proporsyonal sa **kung gaano karami sa wikang iyon ang nasa tumpok**. Ang isang wika na
bubuo sa malaking bahagi ay nakakakuha ng maraming nakalaang piraso, at ang mga salita nito ay lumalabas nang buo
o halos buo. Ang isang wika na halos walang bahagi ay halos walang nakukuhang sariling mga piraso,
at ang mga salita nito ay sinasaklaw ng anumang generic na bahagi na nagkataong magkasya.

Ang isang wika na wala sa tumpok ay nakakakuha ng **zero** na nakalaang piraso. Gumagana
pa rin ito — palaging makakahanap ang tokenizer ng *ilang* paraan upang irepresenta ang teksto,
dahil maaari itong bumalik sa mga indibidwal na karakter o raw bytes. Mas malaki nga lang ang
gagastusin para masabi ang anuman.

:::note[Hindi ito isang bug]
Walang nasira. Ginawa ng compression algorithm ang eksaktong hinihingi
dito. Ang problema ay ang "paikliin ang training text" ay tinanggap bilang isang
proxy para sa "irepresenta nang maayos ang wika", at para sa mga wikang wala sa tekstong iyon, ang
proxy ay ganap na nabibigo.
:::

---

## 3. Fertility: ang numerong nagpapangalan sa pinsala

Ang **Fertility** ay ang average na bilang ng mga token na katumbas ng isang salita.

Para sa isang wika kung saan ang tokenizer ay lubos na sinanay, ang fertility ay malapit sa 1 —
karamihan sa mga salita ay isang piraso lamang. Para sa isang wika na hindi nito kailanman nakita, ang parehong sukat ay maaaring
maging mas mataas nang maraming beses, dahil ang bawat salita ay kailangang buuin mula sa mga bahagi.

Ang iisang numerong iyon ay nagdudulot ng apat na magkakahiwalay na buwis (taxes):

| Buwis | Ano ang ibig sabihin nito |
|---|---|
| **Gastos (Cost)** | Karamihan sa mga komersyal na model ay naniningil bawat token. Ang mas maraming token bawat salita ay nangangahulugang ang parehong pangungusap ay mas mahal isalin, buod, o buuin. |
| **Konteksto (Context)** | Ang mga model ay may nakapirming window. Ang mataas na fertility ay nangangahulugang mas kaunti sa iyong aktwal na dokumento ang magkakasya. |
| **Compute** | Ang mas mahahabang sequence ay mas mabagal, kahit saan, magpakailanman. |
| **Pagkatuto (Learning)** | Ang pinakamahirap. Ang kahulugan ngayon ay nakakalat sa maraming bahagi na may mababang impormasyon, kaya ang model ay may mas mahirap na problemang lutasin — kahit na may magkaparehong data. |

Ang unang tatlo ay hindi patas. Ang ikaapat ay ang sumisira sa kalidad.

**Ito ay sinusukat, hindi iginigiit.** Natuklasan nina Petrov, La Malfa, Torr at Bibi na
ang parehong teksto, na isinalin sa iba't ibang wika, ay maaaring magkaiba sa tokenized
na haba nang **hanggang 15 beses**, at ang pagkakaibang ito ay nananatili sa mga tokenizer
na sadyang binuo para sa multilinggwal na paggamit.

Ang kanilang natuklasan na nagpapakumplikado sa malinaw na solusyon: ang mga character-level at byte-level
na model — ang madaling sagot, "gumamit na lang ng mga titik, para pantay-pantay ang bawat wika" —
ay nagpakita pa rin ng **higit sa 4 na beses** na pagkakaiba para sa ilang pares ng wika. Ang pagbabalik
sa mas maliliit na yunit ay nagpapaliit sa agwat. Hindi nito isinasara iyon.

> Aleksandar Petrov, Emanuele La Malfa, Philip Torr, Adel Bibi.
> *Language Model Tokenizers Introduce Unfairness Between Languages.*
> [NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/74bb24dca8334adce292883b4b651eda-Abstract-Conference.html).

---

## 4. Kung bakit tinatamaan nito ang ilang mga wika nang istruktural, hindi lamang istatistikal

Ang kakulangan sa representasyon sa training pile ay isang dahilan. Mayroong pangalawa, at
hindi ito nawawala sa pamamagitan ng pagdaragdag ng data.

Nagkakaiba ang mga wika sa kung gaano karaming trabaho ang ginagawa ng isang salita.

Sa Ingles, ang isang pangungusap ay kadalasang magkakahiwalay na salita sa isang hilera: *I saw them*. Tatlong
salita, tatlong konsepto, may espasyo sa pagitan nila. Ang mga tokenizer ay binuo ng mga taong
nagtatrabaho sa mga wika na ganito ang pag-uugali, at ipinapalagay nila ito — karamihan sa kanila
ay literal na tinatrato ang isang espasyo bilang hangganan ng isang piraso.

Ang ibang mga wika ay bumubuo ng isang buong sugnay (clause) sa **isang salita**, sa pamamagitan ng pagsasama-sama ng mga makabuluhang
bahagi. Tinatawag ito ng mga linggwista na mga **polysynthetic** na wika, at karaniwan ang mga ito
sa mga Katutubong wika (Indigenous languages) ng mga Amerika, at sa iba pang lugar.

> **Halimbawa.** Sa Plains Cree (nêhiyawêwin), ang *nikî-wâpamâwak* ay nangangahulugang
> humigit-kumulang "I saw them" (Nakita ko sila). Ito ay isang salita. Sa loob nito ay may ilang makabuluhang bahagi:
> kung sino ang kumikilos, na ang aksyon ay nasa nakaraan, ang mismong pagkakita, at kung sino ang
> nakikita.
>
> Ang isang nagsasalita ng Ingles ay nakakakuha ng apat na salita para doon, at ang isang tokenizer na sinanay sa
> Ingles ay malamang na gagastos ng apat na piraso. Ang isang tokenizer na hindi pa nakakita ng Cree
> ay walang entry para sa alinman sa mga bahaging iyon, kaya pinupunit nito ang iisang salita sa
> mga bahagi na hindi gumagalang sa alinman sa mga hangganan na nagdadala ng kahulugan.

Dalawang bagay ang nasisira nang sabay. Ang salita ay nagkakahalaga ng mas maraming piraso kaysa sa dapat sana —
at ang mga piraso ay **humahati sa mga yunit ng kahulugan**, kaya kailangang
buuing muli ng model ang isang istruktura na sinira lang ng tokenizer.

Ang pagdaragdag ng mas maraming teksto ng Cree sa training pile ay nagpapabuti sa unang problema. Bahagya lamang
nitong natutulungan ang pangalawa, dahil ang algorithm ay ino-optimize pa rin ang kompresyon,
at hindi alam ng kompresyon na ang isang hangganan ay makabuluhan.

---

## 5. Mula sa tokenization patungo sa maling sagot

Maikli lang ang kadena mula sa "masamang segmentasyon" patungo sa "maling output".

1. Pinaghihiwalay ng tokenizer ang isang salita sa mga hangganan na walang dalang kahulugan.
2. Natututo ang model ng mas mahihinang asosasyon, dahil ang parehong konsepto ay lumalabas sa ilalim ng
   maraming iba't ibang baybay ng bahagi sa halip na isang pare-parehong piraso.
3. Kapag bumubuo (generating), pinagsasama-sama ng model ang output nang pira-piraso.
4. Ang mga bahagi na indibidwal na kapani-paniwala ay maaaring magsama-sama sa isang salita na **hindi
   umiiral** sa wika.

Ang huling hakbang na iyon ang dapat tandaan. Sa isang wika kung saan ang mga salita ay binuo mula sa
mga bahagi, ang isang model ay maaaring gumawa ng isang bagay na mukhang maayos sa sinumang hindi
nagsasalita nito — mga pirasong mukhang tama, na pinagsama-sama sa isang salita na hindi kailanman sasabihin ng sinumang tagapagsalita.

Kadalasan ay hindi ito mahuhuli ng karaniwang awtomatikong pagmamarka (automatic scoring), dahil ang mga markang iyon ay kadalasang
sumusukat sa pagkakatugma (overlap) sa isang reference na sagot, at ang isang maling salita na gawa sa mga bahaging mukhang tama
ay maaari pa ring magtugma.

:::danger[Kung bakit ito mahalaga nang higit pa sa mga marka ng kalidad]
Ang isang output na matatas ngunit mali ay mas mapanganib kaysa sa isa na halatang
sira. Ang isang mambabasa na hindi nagsasalita ng wika ay walang paraan upang malaman. Ito ay isang
malaking bahagi kung bakit iginigiit ng Champollion ang balidasyon ng mga taong nagsasalita ng
wika, at sa mga istruktural na pagsusuri na nagtatanong ng "ito ba ay isang totoong salita?" sa halip na
"kamukha ba nito ang inaasahang sagot?" lamang.
:::

---

## 6. Sino ang nagpapasya, at kung bakit iyon ang tunay na punto

Ang lahat ng nasa itaas ay sumusunod mula sa isang pagpipilian: **kung aling teksto ang napunta sa tumpok na
pinag-aralan ng tokenizer.**

Sinuman ang gumawa ng pagpiling iyon ay nagpapasya kung paano puputulin ang bawat wika, kung magkano ang
gagastusin para gamitin ito, at kung gaano kahirap kailangang magtrabaho ang model para irepresenta ito. Ang
desisyong iyon ay ginagawa nang minsan, nang maaga, kadalasan ng isang maliit na grupo, at ito ay epektibong
permanente para sa buhay ng model na iyon — ang tokenizer ay hindi isang bagay na maaari mong
i-adjust pagkatapos.

Halos hindi rin ito pinag-uusapan. Ang mga debate tungkol sa teknolohiya ng wika ay kadalasang
tungkol sa data, laki ng model at mga marka ng kalidad. Ang hakbang na nagpapasya kung ang isang
wika ay kayang irepresenta ay nakaupo sa ilalim ng lahat ng iyon, at tinatrato bilang
plumbing (mga tubo at kable).

Iyan ang dahilan kung bakit umiiral ang pahinang ito. Kung nais ng isang komunidad ng tunay na kontrol sa kung paano
pinangangasiwaan ng mga makina ang wika nito, hindi sapat ang pagkontrol sa data. Ang
tanong na *"sino ang nagpasya kung paano puputulin ang ating mga salita sa mga piraso?"* ay may sagot, at
para sa karamihan ng mga wika sa mundo ang sagot na iyon sa kasalukuyan ay: ibang tao, bilang isang
side effect ng pag-compress sa isang tumpok ng teksto na halos hindi naglalaman ng wika
na iyon.

---

## Saan susunod na pupunta

- [Ano ang Champollion](/docs/what-is-champollion) — ang proyekto kung saan kabilang ang pahinang ito, at kung ano ang ginagawa nito tungkol sa mga nasa itaas.
- [Kung paano sinasanay ang mga model](/docs/network/context/mt-training-concepts) — ang bokabularyo para sa hakbang *pagkatapos* ng tokenization, na may parehong diskarte na nagsisimula sa zero.
- [Mga Tapat na Limitasyon (Honest Limitations)](/docs/network/honest-limitations) — kung ano ang **hindi** inaangkin ng proyektong ito.
- [Pangangasiwa ng Data (Data Stewardship)](/docs/network/sovereignty/data-sovereignty) — kung sino ang may hawak ng mga susi sa isang corpus, at kung ano ang ibig sabihin nito sa praktika.
