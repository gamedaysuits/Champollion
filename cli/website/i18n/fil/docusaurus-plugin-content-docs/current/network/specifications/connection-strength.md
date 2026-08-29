---
sidebar_position: 7
title: "Lakas ng Koneksyon (cchrF++)"
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

Kapag gumuguhit ang network map ng arc sa pagitan ng dalawang wika, sinasagot
ng kulay nito ang isang tanong: **gaano kahusay ang pinakamainam na nasukat na pagsasalin sa pagitan nila —
sa tapat na paraan?**

Mas mahirap ang pagiging tapat kaysa sa inaakala. Ipinapaliwanag ng pahinang
ito, sa payak na wika, ang numerong nasa likod ng kulay.

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

## Ang solusyon: ibawas ang floor

Muling isinasaayos ng **Chance-corrected chrF++ (cchrF++)** ang score upang ang 0 ay mangahulugang "hindi
mas mahusay kaysa sa chance" *sa wikang iyon* at ang 1 ay mangahulugang perpekto:

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

Ang mga floor ay sinusukat, hindi ipinapalagay: para sa bawat wika, nagpapatakbo kami ng Monte-Carlo
estimate — libo-libong random same-orthography baselines na sinusuri laban sa tunay na
mga reference — gamit lamang ang pampublikong monolingual text (FLORES-200 dev,
kinukuha mula sa source, hindi kailanman nire-redistribute). Kasalukuyang saklaw ng floor table ang
196 na wika at isa itong artifact na nagmula sa Champollion
(`champollion-derived` provenance; muling binubuo ng
`cli/website/scripts/build-cchrf-floors.mjs`).

Dalawang konserbatibong panuntunan ang nagpapanatiling tapat sa correction:

- **Ikinokorek lamang ang isang pair kapag MAY sinusukat na floor ang MAGKABILANG panig.** Kung
  nawawala ang alinman, ipinapakita ang arc sa neutral slate — *nasukat, ngunit
  hindi alam ang floor* — at hindi kailanman isinasama sa colour ramp.
- **Ginagamit ng pair ang MAS MATAAS sa dalawang floor.** Maaari lamang
  maliitin ng correction ang lakas, hindi kailanman palakihin ito.

## Saan nakapuwesto ang cchrF++ sa hierarchy

Ang cchrF++ ang aming pinakamahusay na *automatic* na sukatan ng lakas — hindi ito ang nasa tuktok ng
hierarchy. Mula sa pinakapinagkakatiwalaan hanggang sa pinakamababa:

1. **Human verification** — mga fluent speaker na humahatol sa output ([speaker
   validation](/docs/network/specifications/speaker-validation)). Walang
   automatic na mas mataas dito.
2. **MQM-style expert annotation** ([Multidimensional Quality
   Metrics](https://aclanthology.org/2014.tc-1.6/), Lommel et al.) — ang
   protocol na ginagamit ng WMT para sa mga gold judgment nito; mahal, bihira, napakahusay.
3. **cchrF++** — chance-corrected, maihahambing sa iba’t ibang wika, murang
   kuwentahin kahit saan.
4. **Raw chrF++ / BLEU / neural metrics** — kapaki-pakinabang sa loob ng isang dataset;
   tingnan ang [Pagiging Maaasahan ng Metric](/docs/network/specifications/metric-reliability)
   para sa kung gaano kalaki ang maaaring paglihis ng bawat isa mula sa human judgment sa inyong pair.

Habang pumapasok sa board ang mga resultang human-verified at MQM-grade,
nagkakaroon ang mga ito ng precedence kaysa sa automatic scores para sa parehong pair.

## Paano ito iginuguhit ng mapa

Bawat visual channel ay may eksaktong isang kahulugan:

| Channel | Kahulugan |
|---------|---------|
| **Kulay** | cchrF++ band — limang hakbang, mula pula hanggang malambot na berde: *malapit sa floor* (&lt; 0.15), *mahina* (0.15–0.35), *umuunlad* (0.35–0.55), *magagamit* (0.55–0.75), *malakas* (≥ 0.75) |
| **Neutral slate** | nasukat, ngunit hindi alam ang chance floor para sa kahit isang panig — hindi kailanman inilalagay sa colour ramp |
| **Dashed + dimmed** | pansamantala: ang test set ay mas mababa sa [significance floor](/docs/network/specifications/significance) (n &lt; 100), kung saan ang mga score gap sa loob ng ~5 chrF++ ay noise |
| **Lapad** | inuulit ang colour band (accessibility redundancy, hindi pangalawang variable) |

Tanging ang mga **nasukat** na pair ang sumasakay sa strength ramp. Ang mga registered pair — nakapila
para sa pagsukat ngunit hindi pa nabibigyan ng score — ay lumilitaw bilang mapupusyaw na flat-coloured
hairlines na ang kulay ay nagsasabi lamang kung *paano maaabot ang pair ngayon*
(commercial API · open-source model · frontier, walang provider), at hindi kung gaano
kahusay magsalin ang alinman. Sadyang magkahiwalay ang dalawang vocabulary:
muted flat threads = reachability, ang red→green ramp = nasukat na lakas.
Ang underlying score ng isang arc ay ang pinakamahusay na nasukat na run para sa pair na iyon sa
public board, na awtomatikong nire-refresh habang pumapasok ang mga bagong run.

## Ang maliliit na detalye

- Ang mga floor ay metric × orthography properties na tinatantiya mula sa monolingual text
  lamang; walang parallel corpus content na sangkot o iniimbak.
- Ipinapakita ng cchrF++ na ang isang pagsasalin ay lumalampas sa chance at kung gaano kalaki ang lamang — hindi nito
  **bini-validate** ang kahulugan, register, o cultural fit. Nananatiling human
  judgments ang mga iyon ([tapat na mga limitasyon](/docs/network/honest-limitations)).
- Ang chance-floor methodology ay pananaliksik ng Champollion; inilalathala rito ang floor atlas at
  ang correction nang eksakto upang maaari itong masuri at
  kuwestiyunin.
