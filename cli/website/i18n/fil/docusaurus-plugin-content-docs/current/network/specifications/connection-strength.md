---
sidebar_position: 7
title: "Lakas ng Koneksyon"
slug: '/network/specifications/connection-strength'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How individual runs are scored"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "How well each metric tracks human judgment, per language pair"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Lakas ng Koneksyon

Kapag gumuhit ang network map ng isang arc sa pagitan ng dalawang wika, sinasagot ng kulay nito
ang isang tanong: **nasukat na ba talaga ang pares na ito?**

Sinasadya itong mas kaunti kaysa sa dating ipinapahayag ng mapa. Hanggang noong 2026-09-04, kinukulayan
ang isang arc ayon sa isang five-step strength ramp — kung gaano *kahusay* ang pinakamagandang salin,
sa isang chance-corrected na iskala. Ang ramp na iyon ay inalis na. Ipinapaliwanag ng pahinang ito
ang numerong nasa likod nito, kung bakit ang pag-aalis nito ang tapat na desisyon,
at kung ano ang sinasabi ng mapa ngayon.

## Ang problema: ang mga raw score ay hindi zero sa zero

Karamihan sa aming mga score ay **chrF++** (character n-gram F-score, [Popović
2017](https://aclanthology.org/W17-4770/)) — sinusukat nito kung gaano kalaki ang
pagkakatugma ng mga character at salita ng isang pagsasalin sa isang reference translation, mula
0 hanggang 100.

Ngunit *ang random text ay hindi zero*. Bawat writing system ay nagbibigay ng ilang overlap "nang
libre": ang orthography na may kakaunting magkakaibang character, o mahahabang predictable na
salita, ay nagkakaroon ng score na masusukat na higit sa zero kahit na walang saysay ang "translation".
Ang libreng overlap na iyon — ang **chance floor** — ay nagkakaiba ayon sa wika. Sa aming
mga sukat, umaabot ito mula humigit-kumulang 1.6 (Chinese script) hanggang higit sa 13
(ilang wikang gumagamit ng Latin at Arabic script). Ang raw chrF++ na 14 ay halos random
noise sa isang wika at tunay na signal sa iba — kaya ang raw chrF++ ay **hindi
maihahambing sa iba’t ibang wika**, at ang mapang kinukulayan batay dito ay tahimik na
magbibigay ng hindi patas na pabor sa ilang script.

Tunay ang problemang ito, at ito ang dahilan kung bakit **hindi** nirarangguhan ng mapa ang lakas
sa iba't ibang wika. Hindi ito isang problemang aming nalutas na.

## Ang ginawa naming pagwawasto, at kung bakit hindi na nito kinukulayan ang mapa

Muling iniiskala ng **chance-corrected chrF++ (cchrF++)** ang isang iskor upang ang 0 ay mangahulugang "walang
kalamangan kaysa sa tsansa" *sa wikang iyon* at ang 1 ay nangangahulugang perpekto:

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

Ang mga floor ay sinusukat, hindi ipinapalagay: para sa bawat wika, nagpapatakbo kami ng isang pagtatantyang
Monte-Carlo — libu-libong random na baseline na may parehong ortograpiya na binigyan ng iskor laban sa mga totoong
reference — gamit lamang ang pampublikong magagamit na monolingual na teksto (FLORES-200 dev,
kinuha mula sa pinagmulan, hindi kailanman muling ipinamahagi). Sinasaklaw ng talahanayan ng floor ang 196 na
wika at ito ay isang artifact na hinango sa Champollion.

**Kung ano ang tunay na pinatutunayan ng pagwawastong iyon.** Umiiral ang chance floor, sumasaklaw
nang halos siyam na ulit sa iba't ibang writing system, at maaaring tantyahin mula sa monolingual
na teksto nang walang anumang label ng kalidad mula sa tao. Ang pagbabawas nito ay mapapatunayang nag-aalis
ng bahagi ng tsansa mula sa mga simpleng baseline: ang isang pandaraya na kopyahin-ang-pinagmulan (copy-the-source) na
may raw score na 15+ sa Finnish ay bumababa sa humigit-kumulang 2.5, at sa karamihan ng mga wika ay eksaktong
sero. Ang "tsansa" na inaalis ay mga surface statistic, hindi natitirang kahulugan.

**Kung ano ang hindi nito pinatutunayan.** Ginagawa nitong magkatulad ang kahulugan ng **0** sa bawat
wika. Hindi nito ginagawang magkatulad ang kahulugan ng **40**. Sa itaas ng floor, ang
pagwawasto ay isang tuwirang muling pag-iiskala, at ang patunay na ang magkatulad na *kalidad*
ay nagbubunga ng magkatulad na naitamang iskor sa iba't ibang wika ay naipakita lamang sa
pinakailalim ng saklaw. Kung ihahambing sa mga grupo ng paghuhusga ng tao, nakakatulong ito kung saan
tunay na magkaiba ang mga floor, walang ginagawa kung saan hindi, at sa isang grupo na may
pantay-pantay na mabababang floor, inilipat nito ang pagkakasundo sa mga tagasuring tao sa *maling*
direksyon — isang resultang hindi pa namin nalulutas.

Ang pagkulay sa isang pampublikong mapa gamit ang five-band strength ramp ay nagpahayag nang higit kaysa sa
sinusuportahan ng ebidensyang iyon, partikular sa mga wikang may kakaunting resources kung saan ang pagkakamali
ang may pinakamalaking epekto. Kaya't inalis na ang ramp hanggang sa malutas ng mga susunod na pag-aaral ang usapin.

Tandaan na ang pagkulay gamit ang **raw** na chrF++ bilang kapalit ay hindi kailanman naging opsyon: ang mga raw score
ay hindi talaga maihahambing sa iba't ibang wika, na siyang buong dahilan kung bakit binuo ang
pagwawasto. Ang isang binary encoding ang tapat na fallback, hindi isang pagbaba sa mas mahinang bagay.

## Kung saan nakalagay ang pagsukat sa herarkiya

Mula sa pinaka hanggang sa pinakamababang mapagkakatiwalaan:

1. **Beripikasyon ng tao** — mga matatas na tagapagsalita na humuhusga sa output ([pagpapatunay ng tagapagsalita](/docs/network/specifications/speaker-validation)). Walang
   awtomatikong bagay ang mas nakatataas dito.
2. **Estilong-MQM na anotasyon ng eksperto** ([Multidimensional Quality
   Metrics](https://aclanthology.org/2014.tc-1.6/), Lommel et al.) — ang
   protocol na ginagamit ng WMT para sa mga gold judgment nito; mahal, bihira, napakahusay.
3. **Mga awtomatikong iskor — sa loob lamang ng isang pares ng wika.** Ang raw na chrF++, BLEU,
   COMET at iba pa ay kapaki-pakinabang sa paghahambing ng mga sistema sa *parehong* pares;
   tingnan ang [Pagiging Maaasahan ng Sukatan](/docs/network/specifications/metric-reliability)
   kung gaano kalubha maaaring subaybayan ng bawat isa ang paghuhusga ng tao sa inyong pares.
4. **Lakas sa iba't ibang wika.** Hindi kami naglalathala ng ranggo. Tingnan sa itaas.

Habang pumapasok sa board ang mga resultang human-verified at MQM-grade,
nagkakaroon ang mga ito ng precedence kaysa sa automatic scores para sa parehong pair.

## Paano ito iginuguhit ng mapa

Bawat visual channel ay may eksaktong isang kahulugan:

| Channel | Kahulugan |
|---------|---------|
| **Kulay** | nasukat na. Isang kulay, walang ramp — sinasabi ng arc na may run na nagbigay ng iskor sa pares na ito, at walang sinasabi tungkol sa kung gaano kahusay |
| **Guhit-guhit + malabo** | pansamantala: ang test set ay mas mababa sa [significance floor](/docs/network/specifications/significance) (n &lt; 100), kung saan ang mga agwat sa iskor na pasok sa ~5 chrF++ ay ingay. Ito ay katangian ng sample size, independyente sa anumang sukatan |
| **Lapad** | palagian. Wala nang natitirang ie-encode |

Tanging ang mga **nasukat** na pares ang gumuguhit ng isang measured arc. Ang mga nakarehistrong pares — nakapila
para sa pagsukat ngunit hindi pa nabibigyan ng iskor — ay lumalabas bilang malalabong hairline na may iisang kulay
kung saan ang kulay ay nagsasaad lamang *kung paano maaabot ang pares ngayon*
(komersyal na API · open-source na modelo · frontier, walang provider), hindi kailanman kung gaano
kahusay nagsasalin ang anuman. Sinasadyang magkahiwalay ang dalawang bokabularyo:
malalabong linyang flat = reachability, ang nag-iisang kulay para sa nasukat = measured.
Ang pinagbabatayang iskor ng isang arc ay ang pinakamahusay na nasukat na run para sa pares na iyon sa
pampublikong board, awtomatikong nirere-refresh habang may dumarating na mga bagong run, at ipinapakita bilang isang
numero sa loob ng pares kapag binuksan ninyo ang arc — hindi kailanman bilang ranggo sa iba't ibang wika.

## Ang maliliit na detalye

- Ang mga chance floor ay mga katangian ng metric × orthography na tinatantya mula sa
  monolingual na teksto lamang; walang nilalaman ng parallel corpus ang sangkot o nakaimbak.
- Ang atlas ng floor at ang pagwawasto ay nananatiling nailathalang pananaliksik, at ang code
  ay nananatili sa repository na sinusuri. Hindi ang mga ito nakakabit sa anumang pampublikong surface.
- **Itinutuwid nito ang floor, hindi ang ceiling.** Kung gaano kataas ang maaaring maging iskor ng isang
  tunay na mahusay na salin ay nag-iiba pa rin ayon sa wika, at walang ginagawa ang pagwawasto tungkol doon.
- **Hindi ito pananggalang laban sa pagkopya sa magkaparehong script.** Ang isang output na kumukopya lamang
  sa pinagmulan ay maaari pa ring makakuha ng iskor na mas mataas sa tsansa kapag ang pinagmulan at target ay nagbabahagi
  ng iisang writing system.
- **Hindi nito mababago ang pagkakasunod-sunod ng mga sistema sa loob ng isang pares ng wika.** Sa itaas ng floor, ang
  pagwawasto ay isang tuwirang muling pag-iiskala, kaya ang mga ranggo sa loob ng pares ay magkapareho
  bago at pagkatapos — ang tanging posibleng halaga nito ay sa pagitan ng magkakaibang pares.
- Sinasabi sa inyo ng isang measured arc na ang isang pares ay nabigyan ng iskor. **Hindi** nito pinatutunayan
  ang kahulugan, register, o cultural fit. Ang mga iyon ay nananatiling mga paghuhusga ng tao ([mga tapat na
  limitasyon](/docs/network/honest-limitations)).
- Ang metodolohiya ng chance-floor ay pananaliksik ng Champollion, na inilathala rito
  upang masuri at matutulan.
