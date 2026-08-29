---
sidebar_position: 5
title: "Ang Coverage Gap: Paano Po Namin Ito Tinatantiya"
description: "Kung paano po pinangangatwiranan ng Champollion ang bilang na “higit sa isang bilyong tao” — ang pamamaraan, ang dalawang pagpapasya sa likod nito, at kung bakit sinasadya ng site na maglahad ng isang konserbatibong pinakamababang taya. Malugod po naming tinatanggap ang mga pagwawasto at debate."
---

# Ang Puwang sa Saklaw: Paano Namin Ito Tinatantiya

> **Buod ng tagapagpaganap.** Sinasabi sa homepage ng Champollion na *higit sa isang bilyong* tao na nabubuhay ngayon ang hindi makakuha ng machine translation sa kanilang unang wika. Ipinapakita ng pahinang ito ang aritmetika sa likod ng pariralang iyon, pinapangalanan ang dalawang pagpapasya na nagpapabago sa bilang, at ipinapaliwanag kung bakit kami naglalathala ng isang konserbatibong pinakamababang bilang sa halip na ang mas malaking hilaw na kabuuan. Ang Champollion ay isang index, hindi isang awtoridad — bawat numero rito ay maaaring makuha mula sa pampublikong build, at malugod po naming tinatanggap ang mga pagwawasto.

## Ang tanong na aktwal naming itinatanong

Hindi "ilang wika ang walang MT," kundi **ilang tao ang hindi makakuha ng machine translation sa kanilang unang wika.** Ang unang wika (L1) ng isang tao ay ang wikang ginagamit nila sa pag-iisip at ang pinakagusto nilang gamitin sa pagbabasa ng balita. Ang pagiging bilingguwal ay hindi nag-aalis sa sinuman mula sa bilang na ito: ang isang bilingguwal sa Quechua–Spanish na ang unang wika ay Quechua ay hindi pa rin makakabasa ng isang webpage *sa Quechua*. Kaya ang target na populasyon ay: lahat ng tao na ang L1 ay isa sa mga buhay na wika na hindi pinaglilingkuran ng anumang nakalaang MT engine.

## Paano kinakalkula ang bilang na ito

Dalawang sangkap, parehong nasa repositoryo:

1. **Aling mga buhay na wika ang may MT.** Pinag-uugnay ng build ang unyon ng mga listahan ng wika ng siyam na sinusubaybayang engine (Google, Microsoft, DeepL, LibreTranslate, NLLB-200, OPUS-MT, M2M-100, MADLAD-400, Tilde — `shared/catalogue/method-coverage.json`, bawat listahan ay may sipi at petsa) sa mga *indibidwal na buhay* na wika ng ISO 639-3 (`isoType: 'L'`) sa `data/tc-index.json`. Resulta: **552 buhay na wika ang saklaw, 6,525 ang hindi saklaw**, mula sa **7,077** na kabuuang buhay na wika (`stats.coverage.dedicatedLiving` / `uncoveredLiving`).
2. **Ilang tao ang nagsasalita ng mga hindi saklaw na wika.** Para sa bawat hindi saklaw na buhay na wika, kinukuha namin ang `speakerCount` nito (hinango mula sa mga siniping pagtatantiya ng language card) at pinagsasama-sama. Inilalabas ito ng build bilang `stats.coverageGap`. Ang hilaw na kabuuan sa lahat ng 6,525 na hindi saklaw na wika ay humigit-kumulang **2.9 bilyon** (`uncoveredSpeakerSumRaw` ≈ 2,974,871,273).

Ang 2.9 bilyon na iyon ay isang **mataas-taas** na bilang, at malinaw po namin itong sinasabi.

### Bakit hindi malinis ang hilaw na kabuuan

Pinaghahalo ng `speakerCount` ang mga nagsasalita ng unang wika (L1) at kabuuang (L1+L2) nagsasalita depende sa kung ano ang iniuulat ng bawat pinagmulan, at ang isang multilingguwal na tao ay maaaring mabilang sa higit sa isang wika. Ang palatandaan: ang pagsasama-sama ng `speakerCount` sa *lahat* ng 7,082 na buhay na wika ay nagbibigay ng humigit-kumulang **10.8 bilyon** — higit pa sa ~8.1 bilyong tao na nabubuhay (UN World Population Prospects). Ang isang malinis na L1 census ay hindi maaaring lumampas sa populasyon ng mundo; ang isang ito ay lumampas, na nagpapatunay na ang field ay hindi purong L1.

## Dalawang pagpapasya (bawat isa ay nagpapabago sa bilang)

**(a) L1-lamang vs. kabuuang bilang.** Ang paglilimita sa mga nagsasalita ng unang wika ay magpapababa sa pagtatantiya — ang mga nagsasalita ng L2 ay, ayon sa pagkakabuo, mga tao na *may* ibang wika. Ngunit ang mga bilang ng L1 bawat wika ay hindi pantay na magagamit sa mga pinagmulan na aming sinisipi, kaya hindi po namin maaaring ilapat ang panuntunang L1-lamang sa lahat ng dako nang hindi nag-iimbento ng mga numero. Ang paggamit ng pinaghalong bilang ay nagpapataas sa pagtatantiya.

**(b) Ang 777 na hindi saklaw na wika na walang naiulat na bilang.** Mula sa 6,525 na hindi saklaw na buhay na wika, **5,748 ang may bilang ng nagsasalita at 777 ang wala** (`uncoveredWithCount` / `uncoveredNoCount`). Ang isantabi ang 777 — na siyang ginagawa ng hilaw na kabuuan — ay *nagkukulang sa bilang*, dahil ang mga ito ay mga totoong wika na may mga totoong (hindi nasusukat na) nagsasalita, karamihan sa kanila ay maliit at nanganganib na mawala.

Kaya ang dalawang pagkakamali ay tumuturo sa magkasalungat na direksyon: ang pinaghalong L1/L2 ay nagpapalaki, at ang buntot ng 777-wika ay nagpapaliit.

## Bakit kami nag-uulat ng pinakamababang bilang na "higit sa isang bilyon"

Ang kapani-paniwalang saklaw ay tumatakbo mula sa pinakamababang bilang na malapit sa **1 bilyon** hanggang sa hilaw na **~2.9 bilyon**. Kahit na pagkatapos ng matinding pagbabawas para sa dobleng pagbibilang ng L2 *at* isantabi ang buong hindi nasusukat na buntot ng 777-wika, ang populasyon ng unang wika ng mga hindi saklaw na wika ay nananatiling komportableng higit sa isang bilyon. Sa halip na gawing headline ang mas malaki at mas magulong numero, inuulat ng site ang konserbatibong dulo. Ang "Higit sa isang bilyon" ay ang pahayag na pinakatiyak po namin na makakaligtas sa pagsusuri.

## Ano ang maaaring magpabago rito

Ang isang mas matalas na pagtatantiya ay nangangailangan ng **mga bilang ng nagsasalita ng L1 bawat wika, bawat isa ay may sipi**, upang direkta po naming mapagsama-sama ang L1 sa halip na ang pinaghalong L1/L2, at makapaglagay ng maipagtatanggol na pagtatantiya sa 777 na kasalukuyang hindi nabibilang na mga wika. Habang nagdaragdag ng mga wika ang mga engine, tumataas ang 552 at kumikitid ang puwang; habang nakakakuha ang mga card ng mga bilang na may mas mahusay na pinagmulan, humihigpit ang kabuuan. Ito ay isang **patuloy na pagtatantiya**, muling kinakalkula sa bawat build — hindi isang nakapirming katotohanan.

## Malugod na tinatanggap ang pagwawasto at debate

Kung mayroon po kayong mas mahusay na data, sa tingin ninyo ay mali ang isang desisyon dito, o maaari ninyong mahanapan ng pinagmulan ang nawawalang 777, sabihin po ninyo sa amin. Iyon ang punto. Magbukas ng isyu sa [github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues) o mag-email sa [info@champollion.dev](mailto:info@champollion.dev).

---

## Mga Pinagmulan

- **Saklaw** — `cli/shared/catalogue/method-coverage.json` (siyam na engine, bawat listahan ay may sipi at petsa) ∩ mga indibidwal na buhay na wika ng ISO 639-3 sa `cli/website/data/tc-index.json`; lumabas bilang `stats.coverage.dedicatedLiving` / `uncoveredLiving`. Hinango sa Champollion.
- **Kabuuan ng mga nagsasalita** — `speakerCount` sa mga hilera ng `tc-index.json` (mula sa siniping `speakerEstimates` ng bawat language card), pinagsama-sama ng build sa `stats.coverageGap` (`uncoveredSpeakerSumRaw`, `uncoveredWithCount`, `uncoveredNoCount`). Hinango sa Champollion; pinaghahalo ang L1/L2 ayon sa pinagmulan.
- **Populasyon ng mundo** — humigit-kumulang 8.1 bilyon (United Nations, *World Population Prospects*), ginamit lamang bilang isang sanity bound sa kabuuan ng mga nagsasalita.

## Saan ito patungo sa site na ito

Ang mga numerong ito ay ang laki ng problema. Ang sagot ng site dito ay nagsisimula
sa [Ano ang Champollion](/docs/what-is-champollion); ang pamamaraan sa likod
ng paghahati ng saklaw/hindi saklaw ay nasa
[paano binibilang ang saklaw](/docs/network/context/coverage-counting), at ang
mga wika sa maling panig ng linya — na niraranggo ayon sa kung sino ang pinakakapani-paniwalang
makakabuo ng isang evaluation set sa susunod — ay inilalathala sa
[corpus wish-list](https://champollion.dev/corpus-wishlist.json).
