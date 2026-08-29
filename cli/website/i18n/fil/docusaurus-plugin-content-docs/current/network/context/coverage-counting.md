---
sidebar_position: 6
title: "Mga Bilang ng Coverage: Paano Namin Ito Binibilang"
description: "Kung paano binibilang ng Champollion ang mga “wika na may machine translation” — ang dalawang tier (anumang engine vs. deployed service), ang SSOT kung saan binabasa ang bawat ipinapakitang numero, at ang disiplina sa pag-refresh. Bukas po kami sa mga pagwawasto."
---

# Mga Bilang ng Saklaw: Paano Namin Sila Binibilang

> **Buod ng ehekutibo.** Kapag sinabi ng site na **552 na mga buhay na wika ang may anumang machine translation** at **196 ang pinaglilingkuran ng isang naka-deploy na serbisyo**, ang mga ito ay dalawang magkaiba at sadyang magkahiwalay na bilang. Tinutukoy ng pahinang ito ang parehong tier, pinapangalanan ang nag-iisang pinagmumulan ng katotohanan (single source of truth) kung saan binabasa ang bawat numero sa oras ng pag-build, at inilalarawan kung paano nire-refresh ang mga listahan. Ang saklaw ay isang *pag-angkin ng pag-iral*, at hindi kailanman isang pag-angkin ng kalidad.

## Ang dalawang tier

**Tier 1 — anumang nakalaang MT engine ("saklaw").** Ang isang buhay na wika ay bibilangin bilang saklaw kung lalabas ito sa inilathalang listahan ng mga sinusuportahang wika ng *anumang* sinusubaybayang nakalaang MT engine — mga naka-deploy na serbisyo para sa consumer/API (Google Translate, Microsoft Translator, DeepL, LibreTranslate, …) **o** mga open research model (NLLB-200, OPUS-MT, M2M-100, MADLAD-400, …). Ito ang unyon na nagpapailaw ng berdeng tuldok sa mapa ng network.

**Tier 2 — naka-deploy na serbisyo ("pinaglilingkuran").** Ang mas mahigpit na kategorya: ang wika ay nasa listahan ng isang engine na *magagamit ngayon* ng sinuman bilang isang consumer o serbisyo ng API. Ang isang open research checkpoint na kailangan mo pang i-download, i-host, at i-serve nang mag-isa ay hindi kabilang dito. Ito ang numerong sumasagot sa "maaari bang isalin ng isang tagapagsalita ang isang webpage ngayon din, nang walang gawaing pang-inhinyero?"

Umiiral ang dalawang tier dahil sumasagot ang mga ito sa magkaibang tanong, at ang pagsasama sa kanila ay nagpapalabis sa saklaw ng mundo. Pareho itong binibilang sa mga **indibidwal na buhay na wika ng ISO 639-3** lamang (`isoType: 'L'`).

## Kung saan nagmumula ang mga numero (walang manu-manong nai-type)

Ang bawat ipinapakitang bilang ay isang **pagbasa sa oras ng pag-build** ng mga SSOT ng makina — walang numero sa site ang nai-type sa teksto at hinayaang maluma:

1. **Ang mga listahan ng bawat engine** ay matatagpuan sa `cli/shared/catalogue/method-coverage.json` —
   isang entry bawat engine, na na-import nang *cite-only* mula sa sariling inilathalang
   listahan ng mga sinusuportahang wika ng provider na iyon, kasama ang `source_url` nito at isang petsa ng `asOf`. Hindi
   ina-audit o ginagaya ng Champollion ang mga listahang ito; ang mga ito ay sariling mga pag-angkin ng mga provider.
2. **Pinagsasama ng build** ang mga listahang iyon sa index ng buhay na wika at inilalabas ang
   mga bilang ng tier sa mga istatistika ng build ng site (`stats.coverage.dedicatedLiving` para sa
   tier 1, `stats.coverage.serviceLiving` para sa tier 2, sa higit `stats.livingTotal`
   na mga buhay na wika).
3. **Nire-render ng mga pahina ang mga istatistika**, at pinapabagsak ng isang pre-push parity gate ang build kung sakaling
   magkaiba ang teksto at mga istatistika.

## Ang "194 na wika" at "187 na wika" ay maaaring parehong totoo

Ang listahan ng isang provider at ang bilang ng mga *wika* ay hindi iisang bagay, kaya idinedeklara ng bawat entry sa SSOT kung alin sa mga ito ang numero nito:

- **`publisher-list-rows`** — ang haba ng sariling inilathalang listahan ng provider,
  eksakto kung paano nila ito inilathala. Ang pahina ng Cloud Translation ng Google ay naglilista ng **194** na hilera
  para sa NMT model nito; iyon ang numerong iniuugnay ng site na ito sa Google sa pamamagitan ng pangalan.
- **`champollion-derived-enumeration`** — ang *aming* pagpapaikli ng listahang iyon sa mga natatanging
  basehang wika ng ISO 639-3. Ang parehong 194 na hilera ng Google ay **187** na wika,
  dahil ang `zh-CN` at `zh-TW` ay iisang wika sa dalawang script, gayundin ang `pt-PT`
  at `pt-BR`, at iba pa. Ang numerong ito ay sa amin, at hindi kailanman sa provider.
- **`publisher-stated-headline`** — isang kabuuan na iginigiit ng provider nang walang listahang
  inilathala sa likod nito. Walang maaaring makuha mula rito.

Ang puwang sa pagitan ng unang dalawa ay aritmetika, hindi hindi pagkakasundo, at nangyayari ito sa bawat provider: Microsoft 135 na hilera → 128 na wika, LibreTranslate 49 → 47, ang 200 FLORES variant ng NLLB-200 → 196. Binabasa ng mapa at ng mga bilang ng tier ang *inisa-isang listahan*, at hindi kailanman ang headline. Pinapabagsak ng isang pre-push gate ang build kung sakaling magkasalungat ang idineklarang batayan ng isang entry at ang listahan nito.

Tandaan din na ang isang provider ay maaaring maglathala ng ilang listahan. Ang pahina ng Google ay naglalaman ng hiwalay na talahanayan para sa Translation LLM tier nito (127 na hilera noong 2026-08-16) at walang isinasaad na pinagsamang kabuuan — kaya ang "ilang wika ang sinusuportahan ng Google?" ay walang iisang inilathalang sagot, at ang site na ito ay hindi nag-iimbento ng isa.

## Ang inangking saklaw ay hindi kalidad — at hindi palaging nade-deploy

Ang isang wika sa listahan ng isang provider ay nangangahulugang *inaangkin ng provider ang suporta*, at wala nang iba pa. Dalawang tala ng katapatan ang inilalapat ng site saanman lumabas ang mga bilang na ito:

- **Saklaw ≠ kalidad.** Kung maganda ba ang mga pagsasalin ay isang hiwalay at
  nasusukat na tanong — iyan ang buong punto ng benchmark network. Ang mga pag-angkin sa kalidad
  ay matatagpuan sa leaderboard, na naka-key ayon sa (pamamaraan, dataset, sukatan); ang mga pag-angkin
  sa saklaw ay matatagpuan dito.
- **Inangkin ≠ nade-deploy.** Ang mga research breadth model ay maaaring mag-angkin ng napakalaking bilang
  ng wika habang ang kanilang sariling dokumentasyon ay nag-uulat ng magagamit na kalidad para sa isang mas maliit na
  subset. Kung saan naglalathala ang isang provider ng ganoong self-assessment, ipinapakita ng site ang
  inangking bilang *at* ang sariling numero ng nade-deploy/kalidad ng provider, na parehong binanggit mula sa
  mga materyales ng provider.

## Ang disiplina sa pag-refresh

Nagbabago ang mga listahan ng provider; dapat sumunod ang mga bilang, nang mekanikal:

- Ang bawat entry sa `method-coverage.json` ay nagtataglay ng sarili nitong petsa ng `asOf`, at ang file
  ay nagtataglay ng top-level na `asOf` — ang petsa ng huling sweep. Ang mga surface na nagpapakita ng
  mga bilang ng saklaw ay nagpapakita o nagli-link sa petsang ito.
- Ang isang **SOTA sweep** (muling pagsuri sa inilathalang listahan ng bawat provider, pagdaragdag ng mga bagong
  sinusubaybayang engine) ay isang pana-panahong gawain sa pagpapanatili; ina-update ng sweep ang SSOT, at
  sumusunod ang bawat bilang sa site sa susunod na build. Walang kailangang "tandaan"
  sa kopya ng pahina.
- Sa pagitan ng mga sweep, ang mga bilang ay kasing-sariwa ng kanilang mga petsa ng `asOf` — kaya naman
  ang mga petsang iyon ay bahagi ng data, at hindi isang footnote convention.

## Tinatanggap ang pagwawasto at debate

Kung nagbago ang listahan ng isang provider, maling naiuri ang isang wika, o sa tingin mo ay mali ang pagkakaguhit ng hangganan ng tier, sabihin sa amin — magbukas ng isyu sa
[github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues)
o mag-email sa [info@champollion.dev](mailto:info@champollion.dev).

---

## Mga Pinagmulan

- **Mga listahan ng bawat engine** — `cli/shared/catalogue/method-coverage.json`: sariling
  inilathalang listahan ng mga sinusuportahang wika ng bawat engine (cite-only; `source_url` + `asOf` bawat entry).
- **Set ng buhay na wika** — mga indibidwal na buhay na wika ng ISO 639-3 (`isoType: 'L'`)
  sa index ng wika na binuo mula sa mga binanggit na language card.
- **Mga bilang ng tier** — inilabas ng build na `stats.coverage.dedicatedLiving` (tier 1),
  `stats.coverage.serviceLiving` (tier 2), `stats.livingTotal`. Hango sa Champollion.
- **Ang pagtatantya ng populasyon na binuo sa mga bilang na ito** — tingnan ang
  [Ang Puwang sa Saklaw: Paano Namin Ito Tinatantya](/docs/network/context/coverage-gap-estimate).
