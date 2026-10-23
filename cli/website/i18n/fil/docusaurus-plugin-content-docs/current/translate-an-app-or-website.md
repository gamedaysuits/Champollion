---
title: "Isalin ang isang app o website"
slug: /translate-an-app-or-website
description: "Isalin ang mga salita sa mga screen ng isang app o website sa inyong wika, panatilihing napapanahon ang mga ito habang nagbabago ang orihinal, at piliin kung aling tagasalin ang hahawak sa bawat wika."
---

# Magsalin ng isang app o website

Ang mga app at website ay nagtatago ng kanilang mga salita — mga button, menu, mensahe, pahina — sa
mga file, isa bawat wika. Kayang punan ng Champollion ang file ng inyong wika para
sa inyo, at panatilihin itong napapanahon tuwing may magbabago sa orihinal. Isang command lang ang
kailangan:

```bash
npx champollion sync
```

Hahanapin nito ang mga file ng wika ng inyong app, isasalin lamang ang mga nawawala o
nabago, susuriin ang bawat salin bago ito isulat, at hahayaang buo ang iba pa.

## Aling tagasalin ang gagawa ng trabaho

Kayo ang pipili, para sa bawat wika:

- **Ang inyong sariling tagasalin**, na binuo sa mga riles — ikinokonekta ito ng mga tool sa inyong
  app. Kung natuto ito mula sa mga pribadong pangungusap, kokonekta lamang ito kapag
  napangalanan na ninyo kung sino, sa mga taong nag-iingat ng mga salita, ang sumang-ayon.
- **Isang modelo ng AI o isang serbisyo sa pagsasalin** — para sa mga wikang mahusay na
  nilang napapangasiwaan. Ipinapadala ng mga ito ang mga salita ng inyong app sa kumpanyang nagpapatakbo sa kanila, kaya
  gamitin ang mga ito para sa tekstong ayos lang ibahagi.
- **Ang inyong sariling serbisyo**, sa isang address na inyong ibibigay.

## Ang mga inaasikaso nito

- **Ang mga nabago lamang.** Naaalala nito ang mga naisalin na nito dati, kaya hindi kayo
  kailanman magbabayad nang dalawang beses para sa parehong pangungusap.
- **Mga pagsusuri bago magsulat.** Ang mga blangkong sagot, ang orihinal na kinopya lang pabalik, mga salitang
  paulit-ulit na umiikot, tekstong higit na mas mahaba kaysa sa nararapat, mga nawawalang bahagi, o
  ang maling alpabeto ay nahuhuli at tinatanggihan. Nahuhuli ng mga pagsusuring ito ang sirang output,
  hindi ang maling kahulugan — tagapagsalita pa rin ang may huling pasya.
- **Inyong mga file, inyong format.** Mga pahina ng JSON, YAML, TOML, at Markdown, at ang
  mga karaniwang framework para sa app at website.

## Kung sino ang maaaring gumamit nito

Libre para sa hindi pangkomersyong paggamit — app ng isang paaralan, website ng komunidad, pampublikong
serbisyo. Ang produkto ng isang negosyo ay hindi sakop ng libreng lisensya; kung nais ng isang komunidad
ng mga tagapagsalita na gamitin ito nang pangkomersyo, magtanong lamang, at libre ang lisensya.
Nasa [Sino ang maaaring gumamit nito](/docs/getting-started/who-may-use-this) ang mga detalye.

**Susunod:** [Mag-host ng isang selyadong pagsubok →](/docs/host-a-sealed-test)

## Magbasa pa

- [Pagsasalin ng app at site](/docs/intro) — ang buong sanggunian: mabilis na pagsisimula,
  pagsasaayos, mga framework, translation memory, ang mga pagsusuri sa kalidad, CI.
- [Paghahatid at pag-deploy](/docs/agents/serving) — pagkonekta sa inyong sariling
  tagasalin.
