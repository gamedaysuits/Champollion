---
title: "Leaderboard at paglalathala"
slug: /reference/leaderboard
description: "Kung ano ang pampublikong leaderboard, ang dalawang uri ng benchmark (pampubliko at sealed), kung ano ang saklaw at hindi saklaw nito, at kung ano mismo ang nilalaman ng isang inilathalang run."
---

# Leaderboard at paglalathala

Ang [leaderboard](/leaderboard) ay isang pampublikong talaan ng mga nasuring run ng pagsasalin.
Kahit sino ay maaaring magdagdag dito: patakbuhin po ninyo ang evaluation harness (`mt-eval`) sa inyong sariling
makina, laban sa isang nakarehistrong dataset, at ilathala ang resulta bilang isang **run
card**. Itinatago ng board ang card; hindi nito pinapatakbo ang inyong pamamaraan para sa inyo. Naglalaman
lamang ito ng bawat-pangungusap na teksto para sa mga lantad ang lisensya at muling maipapamahaging dataset —
hinding-hindi para sa mga di-komersyal, pinaghihigpitan, selyado, naka-quarantine, o lokal-lamang na mga dataset,
at hinding-hindi kapag naglathala kayo gamit ang `--scores-only`.

Ito ay isang talaan ng mga pagsukat, hindi isang hatol sa alinmang tagasalin. Ang posisyon
dito ay nagsasaad lamang kung paano umiskor ang isang pamamaraan sa isang dataset sa ilalim ng isang sukatan. Hindi nito sinasabing
mahusay ang salin, at hindi ito nagbibigay ng pahintulot kaninoman na gumamit ng isang pamamaraan sa wika ng isang
komunidad.

## Tatlong bagay, pinananatiling magkahiwalay

| | Kung ano ito | Kung saan ito tumatakbo |
|---|---|---|
| **Ang harness** ([`mt-eval`](/docs/network/specifications/harness)) | Ang tagapuntos. Gamit ang isang pamamaraan at test set, gumagawa ito ng marka at run card | Ang inyong makina |
| **Ang leaderboard** | Ang lagusan ng pagsusumite at ang talaan ng mga run card, na naka-index ayon sa dataset at direksyon ng pares | champollion.dev |
| **Ang mapa ng network** | Ang kabuuan ng mga nailathalang run: kung aling mga pares ang nasukat na, at kung alin ang hindi pa | Isang pagtingin sa talaan, hindi isang bahagi |

Walang pumapasok sa mapa maliban kung dadaan sa board, at walang pumapasok sa board
maliban kung ito ay isang namarkahan at may-fingerprint na run. Ang isang pagsukat na walang pinagmulan ay hindi
maaaring maging bahagi nito.

## Dalawang uri ng benchmark

Gumagamit ang **mga pampublikong benchmark** ng mga bukas na dataset. Ang bawat dataset ay nakarehistro bilang isang
metadata card na may pointer para sa pagkuha mula sa pinagmulan: dina-download ng harness ang mga
sanggunian mula sa upstream sa oras ng pagpapatakbo, sinusuri ang mga ito laban sa isang naka-pin na SHA-256,
at nagmamarka batay sa nakuha nito. Maaaring bahagi na ng datos ng pagsasanay ng modelo ang pampublikong datos, kaya may dalang antas ng kontaminasyon ang mga dataset. Ang isang set na may gradong `HIGH`
o `MEDIUM` (ang FLORES+ ay `HIGH`), o walang grado, ay **pang-relatibo lamang**:
magagamit upang ihambing ang mga pamamaraang pinatakbo rito, ngunit hindi kailanman iuulat bilang ganap na kalidad.
Tanging ang set na may gradong `LOW` ang nagraranggo batay sa ganap na kalidad. Ang isang naka-quarantine na dataset
ay hindi kailanman nagraranggo: tatanggihan ng database ang isinumiteng marka laban dito.
Ang mga nakarehistrong dataset at ang mga linya ng lisensya ng mga ito ay nakatala sa
[Mga dataset ng ebalwasyon](/docs/network/leaderboard/datasets).

Ang **mga selyadong benchmark** ay mga nakareserbang test set na itinatago ng host sa sarili nilang
makina. Hindi kailanman nakikita ang mga ito ng mga kalahok. Ang isang lahok ay isang modelo o pamamaraan na pinapatakbo
ng sariling scoring node ng host laban sa selyadong set; mga marka lamang ang lumalabas, at
bawat selyadong run ay nangangailangan ng pahintulot ng host. Ang mga key ng mga set ay hawak
ng mga tagapag-organisa sa kasalukuyan. Mga tagapangalaga ng key ng komunidad — wala pang nahihirang sa ngayon;
walang hawak na bahagi ng key ang Champollion. May mga premyo lamang sa mga selyadong paligsahan, ayon sa
mga tuntuning ipinapahayag ng host bago may lumahok. Paano mag-host ng isa:
[Magpatakbo ng soberanong paligsahan](/docs/network/sovereignty/run-a-sovereign-contest).

## Saklaw

- **Nakasulat na teksto.** Sinusukat ng board ang pagsasalin ng nakasulat na teksto: mga dokumento,
  materyal na pang-edukasyon at opisyal, mga UI string. Hindi nito sinusukat ang pananalita,
  real-time na pag-iinterprete, o bukas na pakikipag-chat.
- **Mga wikang nakabatay sa teksto.** Ibang suliranin ang machine translation para sa wikang pasenyas;
  ang mga lahok para sa wikang pasenyas sa index ay nagsasabing "hindi pa napaglilingkuran"
  ([Kung ano ang itinuturing na wika](/docs/network/context/what-counts-as-a-language)).
- **Isang dataset sa bawat pagkakataon.** Maihahambing lamang ang marka sa mga marka sa
  kaparehong bersyon ng dataset. Hindi kailanman tumatawid ang mga ranggo sa iba't ibang dataset o wika.
- **Mga pamamaraan, hindi mga pangungusap.** Inilalarawan ng marka ang isang pamamaraan sa isang benchmark. Walang
  bawat-pangungusap na kumpiyansa ang inilalathala para sa anumang salin
  ([Mga teknikal na limitasyon](/docs/network/honest-limitations#system-vs-output)).

## Ang nilalaman ng isang nailathalang run

Ang bawat bagong card ay namarkahan sa ilalim ng **scoring standard/1**
([Pagtutukoy sa Pagmamarka](/docs/network/specifications/scoring)):

- **Ang pangunahing marka:** antas-korpus na chrF++ (0–100) kalakip ang 95% bootstrap
  confidence interval nito at ang sacreBLEU signature nito, upang muling makwenta ito ng sinoman.
- **Katabi nito:** BLEU, spBLEU, at TER, gayundin ang COMET kapag nakwenta ito. Ipinapakita
  ang mga ito, hindi kailanman inihahalo sa pangunahing marka.
- **Hiwalay:** mga pagsusuring tulad ng pagtanggap ng FST at exact match, kung saan umiiral ang mga kagamitan
  ng mga ito. Hindi kailanman pumapasok ang mga ito sa pangunahing marka o nagraranggo ng isang run.
- **Mga naretiro nang field:** Ang `composite`, `quality_tier`, at `cost_adjusted` ay
  `null` sa bawat bagong card. Pinapanatili ng lumang card ang nakaimbak nitong composite, na ipinapakita bilang
  "legacy composite (retired)". Walang awtomatikong marka ang may dalang tatak ng kalidad.
- **Pinagmulan:** ang id ng dataset at ang SHA-256 nito, ang eksaktong slug ng modelo, ang
  kundisyon, kung ano ang sinabi sa modelo (ang SHA-256 ng prompt, at ang teksto nito
  maliban kung i-redact ninyo ito), ang gastusin, ang bersyon ng harness, at ang isang fingerprint sa
  kumpigurasyon. Awtomatikong pinag-iisa ang magkakaparehong run kapag inilathala, at ang isang independiyenteng
  pag-uulit ay itinuturing na ebidensya.
- **Antas ng pagtitiwala:** bawat hilera ay dumarating bilang *self-benchmarked*. Ang ibig sabihin ng *Champollion Verified*
  ay muling nakuha ang marka mula sa inyong mga isinumiteng output laban sa mga
  naka-pin na sanggunian; ang muling tagapagmarka na iyon ay isang maintainer command na manu-manong pinapatakbo, kaya
  sa ngayon ay walang hilerang itinataas agad pagkadating. Ang *Community Validated* ay iginagawad lamang
  sa pamamagitan ng sariling pagsusuri ng komunidad ([mga antas ng beripikasyon](/docs/network/leaderboard/rules#verification-tiers)).

Ang buong schema ay ang [Pagtutukoy sa Run Card](/docs/network/specifications/run-card).

## Paglalathala

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish to the live board (a browser sign-in the first time)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

- Kinakailangan ang `--prod` (o `MT_EVAL_ALLOW_PROD=1`) para sa pagsusulat sa live
  na board; kung wala ito ay tatanggi ang harness.
- Naglalathala ang `--anonymous` nang hindi nagla-log in; ipinapakita ng board ang "anonymous".
- Naglalathala ang `--scores-only` ng mga pangkalahatang marka at ang hash at laki ng dataset,
  hindi kailanman ang pinagmulang teksto o sanggunian — para sa inyong sarili o sa isang pribadong korpus.
- Pinapalitan ng `--redact-coaching` ang teksto ng prompt ng isang pananda at pinapanatili ang
  hash nito. Naka-redact bilang default ang coached prompt ng isang lokal-lamang na korpus.

Ang sunod-sunod na gabay ay [Magsumite ng pamamaraan](/docs/network/getting-started/submit-a-method).

## Ang mga tuntuning umiiral saanman

- **Huwag kailanman magsanay gamit ang datos ng ebalwasyon.** Ang isang pamamaraang naipamalas sa isang benchmark set — bilang
  datos sa pagsasanay, mga halimbawa ng few-shot, mga entri sa diksyunaryo, o materyal para sa prompt — ay
  madidiskwalipika ([Mga patakaran sa pagsusumite](/docs/network/leaderboard/rules)).
- **Ang pagiging mas mahusay ay pinagpapasyahan ng pagsusuri, hindi ng dalawang numero.** Kung natatalo ng isang run
  ang isa pa ay batay sa isang paired significance test sa chrF++; ang magkakatabing hindi kayang
  paghiwalayin ng pagsubok ay magkasalo sa isang ranggo ([Signipikansya](/docs/network/specifications/significance)).
- **Hindi rito ini-host ang mga korpus.** Metadata lamang ang pagpaparehistro; kinukuha ang
  mga korpus mula sa kanilang pinagmulan. Ang isang nailathalang run ng isang set na lantad ang lisensya ay
  maaaring maglaman ng bawat-pangungusap na teksto nito (sa itaas).
- **Struktural ang mga linya ng lisensya.** Ang mga di-komersyal na korpus ay hindi isinasama sa
  anumang premyo, API, at komersyal na landas. Ang isang korpus na nasa ilalim ng binago, pinasadyang, o
  hindi nakasaad na lisensya (`LicenseRef-*`) ay tatanggi sa malayuang ebalwasyon ng model-API hanggang
  sa maitala sa card nito ang pahintulot ng may-ari ng karapatan; ang mga karaniwang di-komersyal na
  lisensya ay ipinapadala lamang sa mga remote model gamit ang mga channel na walang pagsasanay; ang mga selyadong segment
  ay hindi kailanman ipinapadala sa remote. Ang mga EdTeKLA Plains Cree set ay nakakatalogo bilang mga naka-quarantine na
  label, at tatanggihan ng database ang anumang markang ipapaskil laban sa mga ito.

## Ang tumatakbo sa kasalukuyan

- Ang board ay live, pampubliko, at bukas para sa mga pagsusumite. Ang mga nilalaman nito ay live
  na datos, kaya hindi inilalarawan ng pahinang ito ang mga iyon — [tingnan ang board](/leaderboard).
- Bawat hilera ay self-benchmarked sa kasalukuyan (tingnan ang mga antas ng pagtitiwala sa itaas).
- Walang bukas na premyo, at wala pang markang nakaabot sa pamantayan para sa premyo
  ([Pagtutukoy sa Premyo](/docs/network/specifications/prizes)).
- Wala pang naisasagawang pagsusuri ng mga nagsasalita sa komunidad
  ([Balidasyon ng tagapagsalita](/docs/network/specifications/speaker-validation)).
- Wala pang pamamaraang naipasa sa isang komunidad sa ilalim ng mga tuntunin ng isang paligsahan.

Ang [Mga teknikal na limitasyon](/docs/network/honest-limitations) ang buong talaan ng kung ano
ang hindi inaangkin; kung magkaiba ang pahinang ito at ang pahinang iyon, ang huli ang mananaig.

## Tingnan din

- [Mga tuntunin sa pagsusumite](/docs/network/leaderboard/rules) — kung ano ang tinatanggap,
  diskwalipikasyon, beripikasyon, at reputasyon.
- [Mga dataset ng ebalwasyon](/docs/network/leaderboard/datasets) — ang rehistro at
  ang mga linya ng lisensya nito.
- [Magsumite ng pamamaraan](/docs/network/getting-started/submit-a-method) at ang
  [FAQ](/docs/network/getting-started/faq).
- [Pagmamarka](/docs/network/specifications/scoring),
  [Signipikansya](/docs/network/specifications/significance), at ang
  [Run card](/docs/network/specifications/run-card).
- [Pag-ambag ng compute](/docs/network/getting-started/contributing-compute) —
  magpatakbo ng mga aytem mula sa pampublikong pila gamit ang sarili ninyong key.
